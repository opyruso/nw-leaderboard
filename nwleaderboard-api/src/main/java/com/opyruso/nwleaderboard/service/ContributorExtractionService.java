package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributionPlayerDto;
import com.opyruso.nwleaderboard.dto.ContributionRunDto;
import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.repository.DungeonRepository;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import javax.imageio.ImageIO;
import jakarta.inject.Inject;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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
    private static final int MAX_UPLOADS = 6;

    private static final Pattern WEEK_PATTERN = Pattern.compile("(?i)week\\s*(\\d+)");
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
    public List<ContributionRunDto> extractRuns(MultipartFormDataInput input) throws ContributorRequestException {
        if (input == null) {
            throw new ContributorRequestException("No image provided for extraction");
        }

        List<ImagePayload> images = collectImages(input);
        if (images.isEmpty()) {
            throw new ContributorRequestException("No valid image part found in request");
        }

        List<ContributionRunDto> result = new ArrayList<>();
        for (ImagePayload image : images) {
            result.addAll(processImage(image));
        }
        return result;
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
            throw new ContributorRequestException("A maximum of " + MAX_UPLOADS + " images can be processed per request");
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

    private List<ContributionRunDto> processImage(ImagePayload payload) throws ContributorRequestException {
        BufferedImage image = payload.image();
        ContributionMode declaredMode = detectMode(image);
        Integer detectedWeek = detectWeek(image);
        Long dungeonId = detectDungeon(image);

        List<RowExtraction> rows = extractRows(image, declaredMode);
        if (rows.isEmpty()) {
            return Collections.emptyList();
        }

        return rows.stream()
                .map(row -> buildRun(row, detectedWeek, dungeonId))
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private ContributionRunDto buildRun(RowExtraction row, Integer week, Long dungeonId) {
        List<ContributionPlayerDto> players = mapPlayers(row.players());
        if (players.isEmpty()) {
            return null;
        }

        Integer score = null;
        Integer time = null;
        if (row.mode() == ContributionMode.SCORE && row.score() != null) {
            score = row.score();
        } else if (row.mode() == ContributionMode.TIME && row.timeInSeconds() != null) {
            time = row.timeInSeconds();
        } else if (row.score() != null && row.timeInSeconds() == null) {
            score = row.score();
        } else if (row.timeInSeconds() != null && row.score() == null) {
            time = row.timeInSeconds();
        }

        if (score == null && time == null) {
            return null;
        }

        return new ContributionRunDto(week, dungeonId, score, time, players);
    }

    private List<ContributionPlayerDto> mapPlayers(List<String> names) {
        if (names == null || names.isEmpty()) {
            return Collections.emptyList();
        }

        return names.stream()
                .map(this::normalisePlayerName)
                .filter(Objects::nonNull)
                .map(name -> {
                    Optional<Player> existing = playerRepository.findByPlayerNameIgnoreCase(name);
                    return new ContributionPlayerDto(name, existing.map(Player::getId).orElse(null));
                })
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private String normalisePlayerName(String input) {
        if (input == null) {
            return null;
        }
        String cleaned = input.replaceAll("[\\r\\n]", " ").replaceAll("\\s+", " ").strip();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private ContributionMode detectMode(BufferedImage image) {
        String text = runOcr(image, regionForMode(image), TessPageSegMode.PSM_SINGLE_BLOCK, null);
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

    private Integer detectWeek(BufferedImage image) {
        String text = runOcr(image, regionForWeek(image), TessPageSegMode.PSM_SINGLE_LINE, null);
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
        return null;
    }

    private Long detectDungeon(BufferedImage image) {
        String text = runOcr(image, regionForDungeon(image), TessPageSegMode.PSM_SINGLE_BLOCK, null);
        if (text == null || text.isBlank()) {
            return null;
        }
        String normalised = normalise(text);
        if (normalised.isEmpty()) {
            return null;
        }

        List<Dungeon> dungeons = dungeonRepository.listAll();
        if (dungeons.isEmpty()) {
            return null;
        }

        Dungeon bestMatch = null;
        double bestScore = 0.0;
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
            return bestMatch.getId();
        }
        return null;
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

    private List<RowExtraction> extractRows(BufferedImage image, ContributionMode declaredMode) {
        int width = image.getWidth();
        int height = image.getHeight();

        Rectangle tableArea = regionForTable(image);
        int rows = 5;
        int rowHeight = tableArea.height / rows;

        int playersLeft = (int) (width * 0.32);
        int playersWidth = (int) (width * 0.38);
        int valueLeft = (int) (width * 0.74);
        int valueWidth = (int) (width * 0.14);

        List<RowExtraction> result = new ArrayList<>();
        for (int index = 0; index < rows; index++) {
            int top = tableArea.y + index * rowHeight;
            Rectangle playersRect = new Rectangle(playersLeft, top, playersWidth, rowHeight);
            Rectangle valueRect = new Rectangle(valueLeft, top, valueWidth, rowHeight);

            String playersText = runOcr(image, playersRect, TessPageSegMode.PSM_AUTO, null);
            String valueText = runOcr(image, valueRect, TessPageSegMode.PSM_AUTO,
                    declaredMode == ContributionMode.TIME ? "0123456789:" : null);

            List<String> players = parsePlayers(playersText);
            if (players.isEmpty()) {
                continue;
            }

            Integer score = parseScore(valueText);
            Integer time = parseTime(valueText);

            ContributionMode mode = declaredMode;
            if (mode == null) {
                if (time != null) {
                    mode = ContributionMode.TIME;
                } else if (score != null) {
                    mode = ContributionMode.SCORE;
                }
            }

            if (mode == null) {
                continue;
            }

            if (mode == ContributionMode.SCORE && (score == null || score <= 0)) {
                continue;
            }
            if (mode == ContributionMode.TIME && (time == null || time <= 0)) {
                continue;
            }

            result.add(new RowExtraction(mode, players, score, time));
        }

        return result;
    }

    private List<String> parsePlayers(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return List.of(raw.split("\\r?\\n"))
                .stream()
                .map(String::strip)
                .filter(line -> !line.isEmpty())
                .map(line -> line.replaceAll("^[0-9]+\\.\\s*", ""))
                .collect(Collectors.toCollection(ArrayList::new));
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
        int width = image.getWidth();
        int height = image.getHeight();
        int x = (int) (width * 0.14);
        int y = (int) (height * 0.08);
        int w = (int) (width * 0.42);
        int h = (int) (height * 0.1);
        return new Rectangle(x, y, w, h);
    }

    private Rectangle regionForWeek(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        int x = (int) (width * 0.68);
        int y = (int) (height * 0.08);
        int w = (int) (width * 0.2);
        int h = (int) (height * 0.1);
        return new Rectangle(x, y, w, h);
    }

    private Rectangle regionForMode(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        int x = (int) (width * 0.44);
        int y = (int) (height * 0.17);
        int w = (int) (width * 0.24);
        int h = (int) (height * 0.08);
        return new Rectangle(x, y, w, h);
    }

    private Rectangle regionForTable(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        int x = (int) (width * 0.18);
        int y = (int) (height * 0.27);
        int w = (int) (width * 0.72);
        int h = (int) (height * 0.58);
        return new Rectangle(x, y, w, h);
    }

    private String runOcr(BufferedImage image, Rectangle area, int pageSegMode, String whitelist) {
        Tesseract tesseract = createEngine();
        tesseract.setPageSegMode(pageSegMode);
        if (whitelist != null) {
            tesseract.setTessVariable("tessedit_char_whitelist", whitelist);
        }
        try {
            return tesseract.doOCR(image, area).strip();
        } catch (TesseractException e) {
            LOG.debugf(e, "Unable to run OCR on area %s", area);
            return null;
        }
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

    /**
     * Lightweight immutable representation of an uploaded image.
     */
    private record ImagePayload(String fileName, BufferedImage image) {
    }

    private enum ContributionMode {
        SCORE,
        TIME
    }

    private record RowExtraction(ContributionMode mode, List<String> players, Integer score, Integer timeInSeconds) {
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
