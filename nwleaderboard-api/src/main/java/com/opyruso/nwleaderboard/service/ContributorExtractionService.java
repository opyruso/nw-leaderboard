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
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.awt.image.WritableRaster;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
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

    private static final Rectangle DUNGEON_AREA = new Rectangle(700, 230, 1035, 50);
    private static final Rectangle SCORE_AREA = new Rectangle(1630, 420, 250, 100);
    private static final int PLAYER_BOX_WIDTH = 330;
    private static final int PLAYER_BOX_HEIGHT = 35;
    private static final int PLAYER_ROW_STEP = 135;
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
        cleaned = cleaned.replaceAll("^[0-9]+\\.\\s*", "");
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
        List<RowExtraction> result = new ArrayList<>();
        for (int rowIndex = 0; rowIndex < RUNS_PER_IMAGE; rowIndex++) {
            LinkedHashSet<String> players = new LinkedHashSet<>();
            int yOffset = rowIndex * PLAYER_ROW_STEP;
            for (Point base : PLAYER_BASE_POSITIONS) {
                Rectangle playerRect = new Rectangle(base.x, base.y + yOffset, PLAYER_BOX_WIDTH, PLAYER_BOX_HEIGHT);
                String playerText = runOcr(image, playerRect, TessPageSegMode.PSM_SINGLE_LINE, null);
                String cleaned = normalisePlayerName(playerText);
                if (cleaned != null) {
                    players.add(cleaned);
                }
            }

            if (players.isEmpty()) {
                continue;
            }

            Rectangle valueRect = new Rectangle(SCORE_AREA.x, SCORE_AREA.y + yOffset, SCORE_AREA.width, SCORE_AREA.height);
            String valueText = runOcr(image, valueRect, TessPageSegMode.PSM_SINGLE_LINE, "0123456789:");

            Integer score = declaredMode == ContributionMode.TIME ? null : parseScore(valueText);
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

            if (mode == ContributionMode.SCORE) {
                if (score == null || score <= 0) {
                    continue;
                }
                time = null;
            } else if (mode == ContributionMode.TIME) {
                if (time == null || time <= 0) {
                    continue;
                }
                score = null;
            } else {
                continue;
            }

            result.add(new RowExtraction(mode, new ArrayList<>(players), score, time));
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

    private String runOcr(BufferedImage image, Rectangle area, int pageSegMode, String whitelist) {
        Rectangle bounded = clampToImage(area, image);
        if (bounded.width <= 0 || bounded.height <= 0) {
            return null;
        }

        BufferedImage region = crop(image, bounded);
        BufferedImage preprocessed = preprocessForOcr(region);

        Tesseract tesseract = createEngine();
        tesseract.setPageSegMode(pageSegMode);
        if (whitelist != null) {
            tesseract.setTessVariable("tessedit_char_whitelist", whitelist);
        }
        try {
            return tesseract.doOCR(preprocessed).strip();
        } catch (TesseractException e) {
            LOG.debugf(e, "Unable to run OCR on area %s", bounded);
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
