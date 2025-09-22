package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributionExtractionResponseDto;
import com.opyruso.nwleaderboard.dto.ContributionFieldExtractionDto;
import com.opyruso.nwleaderboard.dto.ContributionRunExtractionDto;
import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.repository.DungeonRepository;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import javax.imageio.ImageIO;
import jakarta.inject.Inject;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.image.WritableRaster;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import net.sourceforge.tess4j.ITessAPI.TessOcrEngineMode;
import net.sourceforge.tess4j.ITessAPI.TessPageSegMode;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.commons.text.similarity.JaroWinklerSimilarity;
import org.jboss.logging.Logger;
import org.jboss.resteasy.plugins.providers.multipart.InputPart;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;


/**
 * Handles OCR extraction on contributor uploads. The implementation relies on the scoreboard layout being
 * rendered at 2560x1440. The layout is divided into fixed regions that are processed individually to extract
 * metadata (week, dungeon, scoreboard type) and per-row information (players and score/time values).
 */
@ApplicationScoped
public class ContributorExtractionService {

    private static final Logger LOG = Logger.getLogger(ContributorExtractionService.class);

    private static final int EXPECTED_WIDTH = 2560;
    private static final int EXPECTED_HEIGHT = 1440;
    private static final int MAX_UPLOADS = 1;

    private static final Rectangle DUNGEON_AREA = new Rectangle(700, 230, 1035, 50);
    private static final Rectangle MODE_AREA = new Rectangle(700, 300, 340, 40);
    private static final Rectangle WEEK_AREA = new Rectangle(2030, 790, 260, 30);
    private static final Rectangle SCORE_AREA = new Rectangle(1630, 420, 250, 100);
    private static final int PLAYER_BOX_WIDTH = 330;
    private static final int PLAYER_BOX_HEIGHT = 35;
    private static final int PLAYER_ROW_STEP = 134;
    private static final int PLAYER_VERTICAL_OFFSET = 5;
    private static final int RUNS_PER_IMAGE = 5;
    private static final List<Point> PLAYER_BASE_POSITIONS = List.of(
            new Point(920, 420),
            new Point(920, 455),
            new Point(920, 490),
            new Point(1305, 420),
            new Point(1305, 455),
            new Point(1305, 490));
    private static final int MAX_PLAYER_SLOTS = PLAYER_BASE_POSITIONS.size();
    private static final int CROP_UPSCALE_FACTOR = 4;
    private static final double GLOBAL_CONTRAST_FACTOR = 1.25d;

    private static final String DEFAULT_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-:/().'";

    private static final Pattern WEEK_PATTERN = Pattern.compile("(?i)(?:week|semaine)?\\s*(\\d{1,3})");
    private static final Pattern TIME_PATTERN = Pattern.compile("(?:(\\d{1,2}):)?(\\d{1,2}):(\\d{2})");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("(\\d[\\d,. ]*)");

    private static final List<String> IMAGE_FIELD_NAMES = List.of("image", "images", "file", "files", "upload", "uploads");

    @Inject
    DungeonRepository dungeonRepository;

    @Inject
    PlayerRepository playerRepository;

    private final JaroWinklerSimilarity similarity = new JaroWinklerSimilarity();

    /**
     * Attempts to extract leaderboard runs from the provided multipart payload.
     *
     * @param input multipart request containing up to {@value #MAX_UPLOADS} images
     * @return a list of extracted runs
     * @throws ContributorRequestException if the payload is invalid or OCR fails unexpectedly
     */
    public ContributionExtractionResponseDto extract(MultipartFormDataInput input) throws ContributorRequestException {
        if (input == null) {
            throw new ContributorRequestException("No image provided for extraction");
        }

        List<ImagePayload> images = collectImages(input);
        if (images.isEmpty()) {
            throw new ContributorRequestException("No valid image part found in request");
        }

        if (images.size() > 1) {
            throw new ContributorRequestException("Only one image can be processed at a time");
        }

        return processImage(images.get(0));
    }

    private List<ImagePayload> collectImages(MultipartFormDataInput input) throws ContributorRequestException {
        Map<String, List<InputPart>> formData = input.getFormDataMap();
        if (formData == null || formData.isEmpty()) {
            throw new ContributorRequestException("No file content provided");
        }
        List<InputPart> allParts = formData.values().stream().flatMap(List::stream).collect(Collectors.toCollection(ArrayList::new));

        List<InputPart> imageParts = new ArrayList<>();
        for (InputPart part : allParts) {
            if (isImagePart(part)) {
                imageParts.add(part);
                continue;
            }
            String name = part.getHeaders().getFirst("Content-Disposition");
            if (name != null) {
                for (String candidate : IMAGE_FIELD_NAMES) {
                    if (name.contains("name=\"" + candidate + "\"")) {
                        imageParts.add(part);
                        break;
                    }
                }
            }
        }

        if (imageParts.size() > MAX_UPLOADS) {
            throw new ContributorRequestException("Only one image can be processed per request");
        }

        List<ImagePayload> result = new ArrayList<>();
        for (InputPart part : imageParts) {
            String fileName = extractFileName(part);
            try (InputStream stream = part.getBody(InputStream.class, null)) {
                BufferedImage bufferedImage = ImageIO.read(stream);
                if (bufferedImage == null) {
                    throw new ContributorRequestException("Unable to decode image " + fileName);
                }
                if (bufferedImage.getWidth() != EXPECTED_WIDTH || bufferedImage.getHeight() != EXPECTED_HEIGHT) {
                    throw new ContributorRequestException(
                            "Image " + fileName + " must have a resolution of " + EXPECTED_WIDTH + "x" + EXPECTED_HEIGHT);
                }
                result.add(new ImagePayload(fileName, bufferedImage));
            } catch (IOException e) {
                throw new ContributorRequestException("Unable to read image " + fileName, e);
            }
        }
        return result;
    }

    private boolean isImagePart(InputPart part) {
        if (part == null || part.getMediaType() == null) {
            return false;
        }
        return "image".equalsIgnoreCase(part.getMediaType().getType());
    }

    private String extractFileName(InputPart part) {
        if (part == null) {
            return "image";
        }
        String contentDisposition = part.getHeaders().getFirst("Content-Disposition");
        if (contentDisposition == null) {
            return "image";
        }
        for (String token : contentDisposition.split(";")) {
            token = token.trim();
            if (token.startsWith("filename=")) {
                String[] parts = token.split("=", 2);
                if (parts.length == 2) {
                    return parts[1].replaceAll("\"", "").strip();
                }
            }
        }
        return "image";
    }

    private ContributionExtractionResponseDto processImage(ImagePayload payload) throws ContributorRequestException {
        BufferedImage originalImage = payload.image();
        BufferedImage preparedImage = prepareContributorImage(originalImage);

        OcrResult modeOcr = runOcr(originalImage, preparedImage, regionForMode(originalImage),
                TessPageSegMode.PSM_SINGLE_BLOCK, null);
        ContributionMode declaredMode = interpretMode(modeOcr.text());
        ContributionFieldExtractionDto modeField = buildModeField(modeOcr, declaredMode);

        OcrResult weekOcr = runOcr(originalImage, preparedImage, regionForWeek(originalImage),
                TessPageSegMode.PSM_SINGLE_LINE, null);
        Integer detectedWeek = extractWeekValue(weekOcr.text());
        ContributionFieldExtractionDto weekField = buildWeekField(weekOcr, detectedWeek);

        OcrResult dungeonOcr = runOcr(originalImage, preparedImage, regionForDungeon(originalImage),
                TessPageSegMode.PSM_SINGLE_BLOCK, null);
        DungeonMatch dungeonMatch = matchDungeon(dungeonOcr.text());
        int expectedPlayerCount = resolveExpectedPlayerCount(dungeonMatch);
        ContributionFieldExtractionDto dungeonField = buildDungeonField(dungeonOcr, dungeonMatch, expectedPlayerCount);

        List<ContributionRunExtractionDto> rows = extractRows(originalImage, preparedImage, declaredMode, expectedPlayerCount);
        ensureRowCount(rows, expectedPlayerCount);

        return new ContributionExtractionResponseDto(weekField, dungeonField, modeField, expectedPlayerCount, rows);
    }

    private ContributionFieldExtractionDto buildModeField(OcrResult ocr, ContributionMode mode) {
        String normalized = mode != null ? mode.name() : null;
        String status = mode != null ? "success" : "warning";
        return buildField(ocr, normalized, null, null, status, null, null);
    }

    private ContributionFieldExtractionDto buildWeekField(OcrResult ocr, Integer week) {
        String normalized = week != null ? String.valueOf(week) : null;
        String status = week != null ? "success" : null;
        return buildField(ocr, normalized, week, null, status, null, null);
    }

    private ContributionFieldExtractionDto buildDungeonField(OcrResult ocr, DungeonMatch match, int expectedPlayerCount) {
        String normalized = match != null ? match.displayName() : null;
        Long id = match != null && match.dungeon() != null ? match.dungeon().getId() : null;
        LinkedHashMap<String, Object> details = new LinkedHashMap<>();
        String status = null;
        Boolean exists = null;
        if (match != null && match.dungeon() != null) {
            status = "success";
            exists = Boolean.TRUE;
            details.put("id", match.dungeon().getId());
            details.put("name", match.displayName());
            Integer configured = match.dungeon().getPlayerCount();
            if (configured != null && configured > 0) {
                details.put("player_count", clampPlayerSlotCount(configured));
            }
        } else if (normalized != null) {
            status = "warning";
            exists = Boolean.FALSE;
        } else {
            status = "warning";
        }
        if (!details.containsKey("player_count") && expectedPlayerCount > 0) {
            details.put("player_count", clampPlayerSlotCount(expectedPlayerCount));
        }
        return buildField(ocr, normalized, null, id, status, exists, details);
    }

    private ContributionFieldExtractionDto buildPlayerField(OcrResult ocr, String normalized, Player existing) {
        LinkedHashMap<String, Object> details = new LinkedHashMap<>();
        Long playerId = null;
        String status = null;
        Boolean alreadyExists = null;
        if (existing != null) {
            playerId = existing.getId();
            status = "success";
            alreadyExists = Boolean.TRUE;
            details.put("id", existing.getId());
            details.put("name", existing.getPlayerName());
        } else if (normalized != null && !normalized.isBlank()) {
            status = "warning";
            alreadyExists = Boolean.FALSE;
        }
        return buildField(ocr, normalized, null, playerId, status, alreadyExists, details);
    }

    private ContributionFieldExtractionDto buildValueField(OcrResult ocr, ContributionMode mode, Integer score, Integer time) {
        Integer number = null;
        String normalized = null;
        if (mode == ContributionMode.SCORE && score != null && score > 0) {
            number = score;
            normalized = String.valueOf(score);
        } else if (mode == ContributionMode.TIME && time != null && time > 0) {
            number = time;
            normalized = formatTimeValue(time);
        }
        return buildField(ocr, normalized, number, null, "warning", null, null);
    }

    private ContributionFieldExtractionDto buildField(OcrResult ocr, String normalized, Integer number, Long id,
            String status, Boolean alreadyExists, Map<String, Object> details) {
        Map<String, Object> safeDetails = sanitiseDetails(details);
        if (ocr == null) {
            return new ContributionFieldExtractionDto(null, normalized, number, id, null, status, alreadyExists,
                    safeDetails);
        }
        String text = ocr.text();
        if (text != null) {
            text = text.strip();
            if (text.isEmpty()) {
                text = null;
            }
        }
        return new ContributionFieldExtractionDto(text, normalized, number, id, encodeToDataUrl(ocr.preprocessed()),
                status, alreadyExists, safeDetails);
    }

    private Map<String, Object> sanitiseDetails(Map<String, Object> details) {
        if (details == null || details.isEmpty()) {
            return null;
        }
        LinkedHashMap<String, Object> filtered = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : details.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                filtered.put(entry.getKey(), entry.getValue());
            }
        }
        return filtered.isEmpty() ? null : Map.copyOf(filtered);
    }

    private void ensureRowCount(List<ContributionRunExtractionDto> rows, int expectedPlayerCount) {
        if (rows == null) {
            return;
        }
        int currentSize = rows.size();
        if (currentSize >= RUNS_PER_IMAGE) {
            return;
        }
        int slotCount = clampPlayerSlotCount(expectedPlayerCount);
        AtomicInteger index = new AtomicInteger(currentSize);
        while (rows.size() < RUNS_PER_IMAGE) {
            List<ContributionFieldExtractionDto> emptyPlayers = new ArrayList<>(slotCount);
            for (int i = 0; i < slotCount; i++) {
                emptyPlayers.add(new ContributionFieldExtractionDto(null, null, null, null, null, null, null, null));
            }
            rows.add(new ContributionRunExtractionDto(
                    index.incrementAndGet(),
                    null,
                    null,
                    null,
                    new ContributionFieldExtractionDto(null, null, null, null, null, null, null, null),
                    emptyPlayers,
                    slotCount));
        }
    }

    private int resolveExpectedPlayerCount(DungeonMatch dungeonMatch) {
        if (dungeonMatch != null && dungeonMatch.dungeon() != null) {
            Integer configured = dungeonMatch.dungeon().getPlayerCount();
            if (configured != null && configured > 0) {
                return clampPlayerSlotCount(configured);
            }
        }
        return MAX_PLAYER_SLOTS;
    }

    private int clampPlayerSlotCount(int desired) {
        if (desired <= 0) {
            return MAX_PLAYER_SLOTS;
        }
        if (desired > MAX_PLAYER_SLOTS) {
            return MAX_PLAYER_SLOTS;
        }
        return desired;
    }

    private ContributionMode interpretMode(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.contains("score")) {
            return ContributionMode.SCORE;
        }
        if (lower.contains("time")) {
            return ContributionMode.TIME;
        }
        return null;
    }

    private ContributionMode resolveRowMode(ContributionMode declaredMode, Integer scoreCandidate, Integer timeCandidate) {
        ContributionMode mode = declaredMode;
        if (mode == null) {
            if (timeCandidate != null && timeCandidate > 0) {
                mode = ContributionMode.TIME;
            } else if (scoreCandidate != null && scoreCandidate > 0) {
                mode = ContributionMode.SCORE;
            }
        }
        if (mode == ContributionMode.SCORE && (scoreCandidate == null || scoreCandidate <= 0)) {
            return null;
        }
        if (mode == ContributionMode.TIME && (timeCandidate == null || timeCandidate <= 0)) {
            return null;
        }
        return mode;
    }

    private Integer extractWeekValue(String text) {
        if (text == null) {
            return null;
        }
        Matcher matcher = WEEK_PATTERN.matcher(text);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException ignored) {
            }
        }
        Matcher digitsOnly = Pattern.compile("(\\d{1,3})").matcher(text);
        if (digitsOnly.find()) {
            try {
                return Integer.parseInt(digitsOnly.group(1));
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private DungeonMatch matchDungeon(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return null;
        }
        String normalised = normalise(rawText);
        if (normalised.isEmpty()) {
            return null;
        }

        List<Dungeon> dungeons = dungeonRepository.listAll();
        if (dungeons.isEmpty()) {
            return null;
        }

        Dungeon bestMatch = null;
        double bestScore = 0.0d;
        for (Dungeon dungeon : dungeons) {
            for (String candidate : namesForDungeon(dungeon)) {
                double score = similarity.apply(normalised, candidate);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = dungeon;
                }
            }
        }

        if (bestMatch != null && bestScore >= 0.75d) {
            String displayName = bestMatch.getNameLocalEn();
            if (displayName == null || displayName.isBlank()) {
                displayName = bestMatch.getNameLocalFr();
            }
            if (displayName == null || displayName.isBlank()) {
                displayName = bestMatch.getNameLocalDe();
            }
            if (displayName == null || displayName.isBlank()) {
                displayName = bestMatch.getNameLocalEs();
            }
            if (displayName == null || displayName.isBlank()) {
                displayName = bestMatch.getNameLocalEsmx();
            }
            if (displayName == null || displayName.isBlank()) {
                displayName = bestMatch.getNameLocalIt();
            }
            if (displayName == null || displayName.isBlank()) {
                displayName = bestMatch.getNameLocalPl();
            }
            if (displayName == null || displayName.isBlank()) {
                displayName = bestMatch.getNameLocalPt();
            }
            return new DungeonMatch(bestMatch, displayName);
        }
        return null;
    }

    private String normalisePlayerName(String input) {
        if (input == null) {
            return null;
        }
        String cleaned = input.replaceAll("[\\r\\n]", " ").replaceAll("\\s+", " ").strip();
        cleaned = cleaned.replaceAll("^[0-9]+\\.\\s*", "");
        return cleaned.isEmpty() ? null : cleaned;
    }

    private Player findExistingPlayer(String cleaned) {
        if (cleaned == null || cleaned.isBlank()) {
            return null;
        }
        Optional<Player> existing = playerRepository.findByPlayerNameIgnoreCase(cleaned);
        return existing.orElse(null);
    }

    private String formatTimeValue(Integer timeInSeconds) {
        if (timeInSeconds == null || timeInSeconds <= 0) {
            return null;
        }
        int total = timeInSeconds;
        int hours = total / 3600;
        int minutes = (total % 3600) / 60;
        int seconds = total % 60;
        if (hours > 0) {
            return String.format(Locale.ROOT, "%02d:%02d:%02d", hours, minutes, seconds);
        }
        return String.format(Locale.ROOT, "%02d:%02d", minutes, seconds);
    }

    private String encodeToDataUrl(BufferedImage image) {
        if (image == null) {
            return null;
        }
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
        } catch (IOException e) {
            LOG.debug("Unable to encode OCR crop", e);
            return null;
        }
    }

    private List<String> namesForDungeon(Dungeon dungeon) {
        if (dungeon == null) {
            return List.of();
        }
        List<String> names = new ArrayList<>();
        names.add(normalise(dungeon.getNameLocalEn()));
        names.add(normalise(dungeon.getNameLocalFr()));
        names.add(normalise(dungeon.getNameLocalDe()));
        names.add(normalise(dungeon.getNameLocalEs()));
        names.add(normalise(dungeon.getNameLocalEsmx()));
        names.add(normalise(dungeon.getNameLocalIt()));
        names.add(normalise(dungeon.getNameLocalPl()));
        names.add(normalise(dungeon.getNameLocalPt()));
        return names.stream().filter(name -> !name.isEmpty()).distinct().toList();
    }

    private String normalise(String value) {
        if (value == null) {
            return "";
        }
        String cleaned = value.replaceAll("[\\r\\n]", " ").replaceAll("[^A-Za-z0-9]+", " ").replaceAll("\\s+", " ")
                .strip().toUpperCase(Locale.ROOT);
        return cleaned;
    }

    private List<ContributionRunExtractionDto> extractRows(BufferedImage originalImage, BufferedImage preparedImage,
            ContributionMode declaredMode, int expectedPlayerCount) {
        List<ContributionRunExtractionDto> result = new ArrayList<>();
        int slotCount = clampPlayerSlotCount(expectedPlayerCount);

        for (int rowIndex = 0; rowIndex < RUNS_PER_IMAGE; rowIndex++) {
            int yOffset = rowIndex * PLAYER_ROW_STEP;
            List<ContributionFieldExtractionDto> playerFields = new ArrayList<>(slotCount);

            for (int slotIndex = 0; slotIndex < slotCount; slotIndex++) {
                Point base = PLAYER_BASE_POSITIONS.get(slotIndex);
                Rectangle playerRect = new Rectangle(base.x, base.y + yOffset + PLAYER_VERTICAL_OFFSET,
                        PLAYER_BOX_WIDTH, PLAYER_BOX_HEIGHT);
                OcrResult playerOcr = runOcr(originalImage, preparedImage, playerRect, TessPageSegMode.PSM_SINGLE_LINE,
                        null);
                String cleaned = normalisePlayerName(playerOcr.text());
                Player existing = findExistingPlayer(cleaned);
                playerFields.add(buildPlayerField(playerOcr, cleaned, existing));
            }

            Rectangle valueRect = new Rectangle(SCORE_AREA.x, SCORE_AREA.y + yOffset, SCORE_AREA.width, SCORE_AREA.height);
            OcrResult valueOcr = runOcr(originalImage, preparedImage, valueRect, TessPageSegMode.PSM_SINGLE_LINE,
                    "0123456789:");

            Integer scoreCandidate = declaredMode == ContributionMode.TIME ? null : parseScore(valueOcr.text());
            Integer timeCandidate = parseTime(valueOcr.text());

            ContributionMode mode = resolveRowMode(declaredMode, scoreCandidate, timeCandidate);
            Integer score = mode == ContributionMode.SCORE ? scoreCandidate : null;
            Integer time = mode == ContributionMode.TIME ? timeCandidate : null;

            ContributionFieldExtractionDto valueField = buildValueField(valueOcr, mode, score, time);

            result.add(new ContributionRunExtractionDto(
                    rowIndex + 1,
                    mode != null ? mode.name() : null,
                    score,
                    time,
                    valueField,
                    playerFields,
                    slotCount));
        }

        return result;
    }

    private Integer parseScore(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher matcher = NUMBER_PATTERN.matcher(raw.replaceAll("\\s", ""));
        if (!matcher.find()) {
            return null;
        }
        String digits = matcher.group(1).replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseTime(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher matcher = TIME_PATTERN.matcher(raw.strip());
        if (!matcher.find()) {
            return null;
        }
        try {
            int hours = 0;
            if (matcher.group(1) != null && !matcher.group(1).isBlank()) {
                hours = Integer.parseInt(matcher.group(1));
            }
            int minutes = Integer.parseInt(matcher.group(2));
            int seconds = Integer.parseInt(matcher.group(3));
            return hours * 3600 + minutes * 60 + seconds;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Rectangle regionForDungeon(BufferedImage image) {
        return clampToImage(DUNGEON_AREA, image);
    }

    private Rectangle regionForWeek(BufferedImage image) {
        return clampToImage(WEEK_AREA, image);
    }

    private Rectangle regionForMode(BufferedImage image) {
        return clampToImage(MODE_AREA, image);
    }

    private OcrResult runOcr(BufferedImage originalImage, BufferedImage preparedImage, Rectangle area, int pageSegMode,
            String whitelist) {
        BufferedImage reference = preparedImage != null ? preparedImage : originalImage;
        Rectangle bounded = clampToImage(area, reference);
        if (bounded.width <= 0 || bounded.height <= 0) {
            return new OcrResult(bounded, null, null, null);
        }

        BufferedImage originalRegion = originalImage != null ? crop(originalImage, bounded) : null;
        BufferedImage baseRegion;
        if (preparedImage != null) {
            baseRegion = crop(preparedImage, bounded);
        } else {
            baseRegion = originalRegion;
        }
        if (baseRegion == null) {
            return new OcrResult(bounded, originalRegion, null, null);
        }

        BufferedImage preprocessed = preprocessForOcr(baseRegion);
        if (preprocessed == null) {
            preprocessed = baseRegion;
        }

        Tesseract tesseract = createEngine();
        tesseract.setPageSegMode(pageSegMode);
        tesseract.setTessVariable("tessedit_char_whitelist", whitelist != null ? whitelist : DEFAULT_WHITELIST);

        String text = null;
        try {
            text = tesseract.doOCR(preprocessed);
        } catch (TesseractException e) {
            LOG.debugf(e, "Unable to run OCR on area %s", bounded);
        }

        if (text != null) {
            text = text.strip();
            if (text.isEmpty()) {
                text = null;
            }
        }

        return new OcrResult(bounded, originalRegion, preprocessed, text);
    }

    private Tesseract createEngine() {
        Tesseract tesseract = new Tesseract();
        tesseract.setLanguage("eng");
        tesseract.setOcrEngineMode(TessOcrEngineMode.OEM_LSTM_ONLY);
        String dataPath = resolveTessDataPath();
        if (dataPath != null) {
            tesseract.setDatapath(dataPath);
        }
        tesseract.setTessVariable("user_defined_dpi", "300");
        tesseract.setTessVariable("load_system_dawg", "0");
        tesseract.setTessVariable("load_freq_dawg", "0");
        return tesseract;
    }

    private String resolveTessDataPath() {
        List<String> candidates = new ArrayList<>();
        String env = System.getenv("TESSDATA_PREFIX");
        if (env != null) {
            candidates.add(env);
        }
        candidates.add("/usr/share/tesseract-ocr/4.00/tessdata");
        candidates.add("/usr/share/tesseract-ocr/tessdata");
        candidates.add("/usr/share/tessdata");

        for (String candidate : candidates) {
            if (candidate == null) {
                continue;
            }
            Path path = Path.of(candidate);
            if (Files.isDirectory(path)) {
                return path.toAbsolutePath().toString();
            }
        }
        return null;
    }

    private Rectangle clampToImage(Rectangle rect, BufferedImage image) {
        int x = Math.max(0, rect.x);
        int y = Math.max(0, rect.y);
        int width = Math.min(rect.width, image.getWidth() - x);
        int height = Math.min(rect.height, image.getHeight() - y);
        if (width <= 0 || height <= 0) {
            return new Rectangle(0, 0, 0, 0);
        }
        return new Rectangle(x, y, width, height);
    }

    private BufferedImage crop(BufferedImage source, Rectangle area) {
        BufferedImage target = new BufferedImage(area.width, area.height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.drawImage(source, 0, 0, area.width, area.height, area.x, area.y, area.x + area.width,
                    area.y + area.height, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private BufferedImage prepareContributorImage(BufferedImage source) {
        if (source == null || source.getWidth() <= 0 || source.getHeight() <= 0) {
            return source;
        }

        BufferedImage working = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = working.createGraphics();
        try {
            graphics.drawImage(source, 0, 0, null);
        } finally {
            graphics.dispose();
        }

        WritableRaster raster = working.getRaster();
        int[] pixel = new int[raster.getNumBands()];
        int width = working.getWidth();
        int height = working.getHeight();
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                raster.getPixel(x, y, pixel);
                for (int i = 0; i < pixel.length; i++) {
                    int inverted = 255 - pixel[i];
                    int contrasted = (int) Math.round((inverted - 128) * GLOBAL_CONTRAST_FACTOR + 128);
                    pixel[i] = clampToByte(contrasted);
                }
                raster.setPixel(x, y, pixel);
            }
        }
        return working;
    }

    private int clampToByte(int value) {
        if (value < 0) {
            return 0;
        }
        if (value > 255) {
            return 255;
        }
        return value;
    }

    private BufferedImage preprocessForOcr(BufferedImage region) {
        if (region == null) {
            return null;
        }
        int width = region.getWidth();
        int height = region.getHeight();
        if (width <= 0 || height <= 0) {
            return region;
        }

        int targetWidth = Math.max(1, width * CROP_UPSCALE_FACTOR);
        int targetHeight = Math.max(1, height * CROP_UPSCALE_FACTOR);
        int type = region.getType();
        if (type == BufferedImage.TYPE_CUSTOM || type == 0) {
            type = BufferedImage.TYPE_INT_RGB;
        }

        BufferedImage upscaled = new BufferedImage(targetWidth, targetHeight, type);
        Graphics2D graphics = upscaled.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.drawImage(region, 0, 0, targetWidth, targetHeight, null);
        } finally {
            graphics.dispose();
        }
        return upscaled;
    }

    /**
     * Lightweight immutable representation of an uploaded image.
     */
    private record ImagePayload(String fileName, BufferedImage image) {
    }

    private enum ContributionMode {
        SCORE,
        TIME
    }

    private record DungeonMatch(Dungeon dungeon, String displayName) {
    }

    private record OcrResult(Rectangle area, BufferedImage original, BufferedImage preprocessed, String text) {
    }

    /**
     * Checked exception raised when contributor extraction cannot be completed.
     */
    public static class ContributorRequestException extends Exception {

        private static final long serialVersionUID = 1L;

        public ContributorRequestException(String message) {
            super(message);
        }

        public ContributorRequestException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
