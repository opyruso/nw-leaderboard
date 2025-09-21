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
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.awt.image.WritableRaster;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
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
import org.bytedeco.javacv.Java2DFrameConverter;
import org.bytedeco.javacv.OpenCVFrameConverter;
import org.bytedeco.opencv.opencv_imgproc.CLAHE;
import org.bytedeco.opencv.opencv_core.Mat;
import org.bytedeco.opencv.opencv_core.Size;
import org.apache.commons.text.similarity.JaroWinklerSimilarity;
import org.jboss.logging.Logger;
import org.jboss.resteasy.plugins.providers.multipart.InputPart;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;

import static org.bytedeco.opencv.global.opencv_imgproc.MORPH_RECT;
import static org.bytedeco.opencv.global.opencv_core.bitwise_not;
import static org.bytedeco.opencv.global.opencv_imgproc.ADAPTIVE_THRESH_GAUSSIAN_C;
import static org.bytedeco.opencv.global.opencv_imgproc.COLOR_BGR2GRAY;
import static org.bytedeco.opencv.global.opencv_imgproc.INTER_CUBIC;
import static org.bytedeco.opencv.global.opencv_imgproc.THRESH_BINARY;
import static org.bytedeco.opencv.global.opencv_imgproc.adaptiveThreshold;
import static org.bytedeco.opencv.global.opencv_imgproc.bilateralFilter;
import static org.bytedeco.opencv.global.opencv_imgproc.createCLAHE;
import static org.bytedeco.opencv.global.opencv_imgproc.cvtColor;
import static org.bytedeco.opencv.global.opencv_imgproc.dilate;
import static org.bytedeco.opencv.global.opencv_imgproc.getStructuringElement;
import static org.bytedeco.opencv.global.opencv_imgproc.resize;

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
    private static final int RUNS_PER_IMAGE = 5;
    private static final List<Point> PLAYER_BASE_POSITIONS = List.of(
            new Point(920, 415),
            new Point(920, 450),
            new Point(920, 485),
            new Point(1305, 415),
            new Point(1305, 450),
            new Point(1305, 485));
    private static final int ADAPTIVE_BLOCK_SIZE = 15;
    private static final int ADAPTIVE_MEAN_OFFSET = 5;
    private static final double UPSCALE_FACTOR = 3.0d;
    private static final double CLAHE_CLIP_LIMIT = 2.0d;
    private static final Size CLAHE_TILE_GRID = new Size(8, 8);
    private static final int BILATERAL_FILTER_DIAMETER = 5;
    private static final double BILATERAL_SIGMA_COLOR = 15.0d;
    private static final double BILATERAL_SIGMA_SPACE = 15.0d;
    private static final int OPENCV_ADAPTIVE_BLOCK_SIZE = 31;
    private static final int OPENCV_ADAPTIVE_C = 5;
    private static final Size DILATION_KERNEL = new Size(2, 2);

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
        BufferedImage image = payload.image();

        OcrResult modeOcr = runOcr(image, regionForMode(image), TessPageSegMode.PSM_SINGLE_BLOCK, null);
        ContributionMode declaredMode = interpretMode(modeOcr.text());
        ContributionFieldExtractionDto modeField = buildModeField(modeOcr, declaredMode);

        OcrResult weekOcr = runOcr(image, regionForWeek(image), TessPageSegMode.PSM_SINGLE_LINE, null);
        Integer detectedWeek = extractWeekValue(weekOcr.text());
        ContributionFieldExtractionDto weekField = buildWeekField(weekOcr, detectedWeek);

        OcrResult dungeonOcr = runOcr(image, regionForDungeon(image), TessPageSegMode.PSM_SINGLE_BLOCK, null);
        DungeonMatch dungeonMatch = matchDungeon(dungeonOcr.text());
        ContributionFieldExtractionDto dungeonField = buildDungeonField(dungeonOcr, dungeonMatch);

        List<ContributionRunExtractionDto> rows = extractRows(image, declaredMode);
        ensureRowCount(rows);

        return new ContributionExtractionResponseDto(weekField, dungeonField, modeField, rows);
    }

    private ContributionFieldExtractionDto buildModeField(OcrResult ocr, ContributionMode mode) {
        String normalized = mode != null ? mode.name() : null;
        return buildField(ocr, normalized, null, null);
    }

    private ContributionFieldExtractionDto buildWeekField(OcrResult ocr, Integer week) {
        String normalized = week != null ? String.valueOf(week) : null;
        return buildField(ocr, normalized, week, null);
    }

    private ContributionFieldExtractionDto buildDungeonField(OcrResult ocr, DungeonMatch match) {
        String normalized = match != null ? match.displayName() : null;
        Long id = match != null && match.dungeon() != null ? match.dungeon().getId() : null;
        return buildField(ocr, normalized, null, id);
    }

    private ContributionFieldExtractionDto buildPlayerField(OcrResult ocr, String normalized, Long playerId) {
        return buildField(ocr, normalized, null, playerId);
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
        return buildField(ocr, normalized, number, null);
    }

    private ContributionFieldExtractionDto buildField(OcrResult ocr, String normalized, Integer number, Long id) {
        if (ocr == null) {
            return new ContributionFieldExtractionDto(null, normalized, number, id, null);
        }
        String text = ocr.text();
        if (text != null) {
            text = text.strip();
            if (text.isEmpty()) {
                text = null;
            }
        }
        return new ContributionFieldExtractionDto(text, normalized, number, id, encodeToDataUrl(ocr.original()));
    }

    private void ensureRowCount(List<ContributionRunExtractionDto> rows) {
        if (rows == null) {
            return;
        }
        int currentSize = rows.size();
        if (currentSize >= RUNS_PER_IMAGE) {
            return;
        }
        AtomicInteger index = new AtomicInteger(currentSize);
        while (rows.size() < RUNS_PER_IMAGE) {
            List<ContributionFieldExtractionDto> emptyPlayers = new ArrayList<>(PLAYER_BASE_POSITIONS.size());
            for (int i = 0; i < PLAYER_BASE_POSITIONS.size(); i++) {
                emptyPlayers.add(new ContributionFieldExtractionDto(null, null, null, null, null));
            }
            rows.add(new ContributionRunExtractionDto(
                    index.incrementAndGet(),
                    null,
                    null,
                    null,
                    new ContributionFieldExtractionDto(null, null, null, null, null),
                    emptyPlayers));
        }
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

    private Long findPlayerId(String cleaned) {
        if (cleaned == null || cleaned.isBlank()) {
            return null;
        }
        Optional<Player> existing = playerRepository.findByPlayerNameIgnoreCase(cleaned);
        return existing.map(Player::getId).orElse(null);
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

    private List<ContributionRunExtractionDto> extractRows(BufferedImage image, ContributionMode declaredMode) {
        List<ContributionRunExtractionDto> result = new ArrayList<>();
        int slotCount = PLAYER_BASE_POSITIONS.size();

        for (int rowIndex = 0; rowIndex < RUNS_PER_IMAGE; rowIndex++) {
            int yOffset = rowIndex * PLAYER_ROW_STEP;
            List<ContributionFieldExtractionDto> playerFields = new ArrayList<>(slotCount);

            for (Point base : PLAYER_BASE_POSITIONS) {
                Rectangle playerRect = new Rectangle(base.x, base.y + yOffset, PLAYER_BOX_WIDTH, PLAYER_BOX_HEIGHT);
                OcrResult playerOcr = runOcr(image, playerRect, TessPageSegMode.PSM_SINGLE_LINE, null);
                String cleaned = normalisePlayerName(playerOcr.text());
                Long playerId = findPlayerId(cleaned);
                playerFields.add(buildPlayerField(playerOcr, cleaned, playerId));
            }

            Rectangle valueRect = new Rectangle(SCORE_AREA.x, SCORE_AREA.y + yOffset, SCORE_AREA.width, SCORE_AREA.height);
            OcrResult valueOcr = runOcr(image, valueRect, TessPageSegMode.PSM_SINGLE_LINE, "0123456789:");

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
                    playerFields));
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

    private OcrResult runOcr(BufferedImage image, Rectangle area, int pageSegMode, String whitelist) {
        Rectangle bounded = clampToImage(area, image);
        if (bounded.width <= 0 || bounded.height <= 0) {
            return new OcrResult(bounded, null, null, null);
        }

        BufferedImage region = crop(image, bounded);
        BufferedImage preprocessed = preprocessForOcr(region);

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

        return new OcrResult(bounded, region, preprocessed, text);
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

    private BufferedImage preprocessForOcr(BufferedImage region) {
        if (region.getWidth() <= 0 || region.getHeight() <= 0) {
            return region;
        }

        try (Java2DFrameConverter java2DConverter = new Java2DFrameConverter();
                OpenCVFrameConverter.ToMat matConverter = new OpenCVFrameConverter.ToMat()) {
            Mat bgr = matConverter.convert(java2DConverter.convert(region));
            if (bgr == null || bgr.empty()) {
                if (bgr != null) {
                    bgr.close();
                }
                return legacyPreprocess(region);
            }

            try (Mat gray = new Mat();
                    Mat upscaled = new Mat();
                    Mat claheMat = new Mat();
                    Mat smooth = new Mat();
                    Mat binary = new Mat();
                    Mat inverted = new Mat();
                    Mat dilated = new Mat()) {
                cvtColor(bgr, gray, COLOR_BGR2GRAY);
                resize(gray, upscaled, new Size(), UPSCALE_FACTOR, UPSCALE_FACTOR, INTER_CUBIC);

                CLAHE clahe = createCLAHE(CLAHE_CLIP_LIMIT, CLAHE_TILE_GRID);
                try {
                    clahe.apply(upscaled, claheMat);
                } finally {
                    clahe.close();
                }

                bilateralFilter(claheMat, smooth, BILATERAL_FILTER_DIAMETER, BILATERAL_SIGMA_COLOR, BILATERAL_SIGMA_SPACE);
                adaptiveThreshold(smooth, binary, 255, ADAPTIVE_THRESH_GAUSSIAN_C, THRESH_BINARY,
                        OPENCV_ADAPTIVE_BLOCK_SIZE, OPENCV_ADAPTIVE_C);
                bitwise_not(binary, inverted);

                Mat kernel = getStructuringElement(MORPH_RECT, DILATION_KERNEL);
                try {
                    dilate(inverted, dilated, kernel);
                } finally {
                    kernel.close();
                }

                BufferedImage processed = java2DConverter.convert(matConverter.convert(dilated));
                return ensureGrayscale(processed);
            } finally {
                bgr.close();
            }
        } catch (RuntimeException | UnsatisfiedLinkError e) {
            LOG.debug("Falling back to legacy OCR preprocessing", e);
            return legacyPreprocess(region);
        }
    }

    private BufferedImage legacyPreprocess(BufferedImage region) {
        BufferedImage gray = new BufferedImage(region.getWidth(), region.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D graphics = gray.createGraphics();
        try {
            graphics.drawImage(region, 0, 0, null);
        } finally {
            graphics.dispose();
        }
        BufferedImage thresholded = applyAdaptiveThreshold(gray, ADAPTIVE_BLOCK_SIZE, ADAPTIVE_MEAN_OFFSET);
        return applySharpen(thresholded);
    }

    private BufferedImage ensureGrayscale(BufferedImage image) {
        if (image == null) {
            return null;
        }
        if (image.getType() == BufferedImage.TYPE_BYTE_GRAY) {
            return image;
        }
        BufferedImage gray = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D graphics = gray.createGraphics();
        try {
            graphics.drawImage(image, 0, 0, null);
        } finally {
            graphics.dispose();
        }
        return gray;
    }

    private BufferedImage applyAdaptiveThreshold(BufferedImage gray, int blockSize, int meanOffset) {
        int width = gray.getWidth();
        int height = gray.getHeight();
        int radius = Math.max(1, blockSize / 2);

        BufferedImage result = new BufferedImage(width, height, BufferedImage.TYPE_BYTE_GRAY);
        WritableRaster sourceRaster = gray.getRaster();
        WritableRaster targetRaster = result.getRaster();

        long[][] integral = new long[height + 1][width + 1];
        for (int y = 1; y <= height; y++) {
            long rowSum = 0;
            for (int x = 1; x <= width; x++) {
                int pixel = sourceRaster.getSample(x - 1, y - 1, 0);
                rowSum += pixel;
                integral[y][x] = integral[y - 1][x] + rowSum;
            }
        }

        for (int y = 0; y < height; y++) {
            int y0 = Math.max(0, y - radius);
            int y1 = Math.min(height - 1, y + radius);
            for (int x = 0; x < width; x++) {
                int x0 = Math.max(0, x - radius);
                int x1 = Math.min(width - 1, x + radius);

                int area = (x1 - x0 + 1) * (y1 - y0 + 1);
                long sum = integral[y1 + 1][x1 + 1] - integral[y0][x1 + 1] - integral[y1 + 1][x0] + integral[y0][x0];
                int threshold = (int) (sum / area) - meanOffset;
                threshold = Math.max(0, Math.min(255, threshold));

                int pixel = sourceRaster.getSample(x, y, 0);
                int value = pixel > threshold ? 255 : 0;
                targetRaster.setSample(x, y, 0, value);
            }
        }

        return result;
    }

    private BufferedImage applySharpen(BufferedImage image) {
        float[] kernelData = new float[] {
                0f, -1f, 0f,
                -1f, 5f, -1f,
                0f, -1f, 0f
        };
        Kernel kernel = new Kernel(3, 3, kernelData);
        ConvolveOp op = new ConvolveOp(kernel, ConvolveOp.EDGE_NO_OP, null);
        BufferedImage result = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        op.filter(image, result);
        return result;
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
