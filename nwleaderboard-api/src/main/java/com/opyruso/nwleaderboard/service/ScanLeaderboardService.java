package com.opyruso.nwleaderboard.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opyruso.nwleaderboard.dto.ContributionExtractionResponseDto;
import com.opyruso.nwleaderboard.dto.ContributionScanDetailDto;
import com.opyruso.nwleaderboard.dto.ContributionScanSummaryDto;
import com.opyruso.nwleaderboard.entity.ScanLeaderboard;
import com.opyruso.nwleaderboard.repository.ScanLeaderboardRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.awt.image.BufferedImage;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;
import org.jboss.logging.Logger;

/**
 * Coordinates persistence and retrieval of stored leaderboard scans.
 */
@ApplicationScoped
public class ScanLeaderboardService {

    private static final Logger LOG = Logger.getLogger(ScanLeaderboardService.class);

    private static final String DEFAULT_LEADERBOARD_TYPE = "Unknown";

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    @Inject
    ScanLeaderboardRepository repository;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    RegionService regionService;

    @Transactional
    public void storeScan(BufferedImage image, byte[] picture, ContributionExtractionResponseDto extraction,
            Integer weekCandidate, Long dungeonIdCandidate, String leaderboardTypeCandidate) {
        if (image == null || picture == null || extraction == null) {
            return;
        }
        ScanLeaderboard scan = new ScanLeaderboard();
        scan.setWidth(image.getWidth());
        scan.setHeight(image.getHeight());
        scan.setPicture(picture);
        scan.setWeek(Optional.ofNullable(weekCandidate).orElse(0));
        scan.setDungeonId(Optional.ofNullable(dungeonIdCandidate).orElse(0L));
        scan.setLeaderboardType(normalizeLeaderboardType(leaderboardTypeCandidate));
        scan.setExtractData(writeExtraction(extraction));
        scan.setRegion(regionService.requireDefaultRegion());
        repository.persist(scan);
    }

    public List<ContributionScanSummaryDto> listScans() {
        return repository.list("order by creationDate desc").stream()
                .map(this::toSummaryDto)
                .collect(Collectors.toList());
    }

    public ContributionScanDetailDto getScanDetail(Long id) {
        if (id == null) {
            return null;
        }
        ScanLeaderboard scan = repository.findById(id);
        if (scan == null) {
            return null;
        }
        ContributionExtractionResponseDto extraction = readExtraction(scan.getExtractData());
        String picture = encodePicture(scan.getPicture());
        return new ContributionScanDetailDto(scan.getId(), scan.getWeek(), scan.getDungeonId(), scan.getLeaderboardType(),
                scan.getWidth(), scan.getHeight(), picture, extraction);
    }

    @Transactional
    public ScanLeaderboard findRawScan(Long id) {
        if (id == null) {
            return null;
        }
        return repository.findById(id);
    }

    @Transactional
    public ContributionScanDetailDto updateScan(Long id, Integer weekCandidate, Long dungeonIdCandidate,
            String leaderboardTypeCandidate, ContributionExtractionResponseDto extraction) {
        if (id == null) {
            return null;
        }
        ScanLeaderboard scan = repository.findById(id);
        if (scan == null) {
            return null;
        }
        if (scan.getRegion() == null) {
            scan.setRegion(regionService.requireDefaultRegion());
        }
        if (extraction != null) {
            scan.setExtractData(writeExtraction(extraction));
        }
        if (weekCandidate != null) {
            scan.setWeek(weekCandidate);
        }
        if (dungeonIdCandidate != null) {
            scan.setDungeonId(dungeonIdCandidate);
        }
        if (leaderboardTypeCandidate != null && !leaderboardTypeCandidate.isBlank()) {
            scan.setLeaderboardType(normalizeLeaderboardType(leaderboardTypeCandidate));
        }
        return getScanDetail(id);
    }

    @Transactional
    public void deleteScan(Long id) {
        if (id == null) {
            return;
        }
        repository.deleteById(id);
    }

    private ContributionScanSummaryDto toSummaryDto(ScanLeaderboard scan) {
        String createdAt = null;
        if (scan.getCreationDate() != null) {
            createdAt = scan.getCreationDate().atOffset(ZoneOffset.UTC).format(ISO_FORMATTER);
        }
        return new ContributionScanSummaryDto(scan.getId(), scan.getWeek(), scan.getDungeonId(),
                scan.getLeaderboardType(), createdAt);
    }

    private String normalizeLeaderboardType(String type) {
        if (type == null || type.isBlank()) {
            return DEFAULT_LEADERBOARD_TYPE;
        }
        String trimmed = type.trim();
        if (trimmed.equalsIgnoreCase("maximum score")) {
            return "Maximum Score";
        }
        if (trimmed.equalsIgnoreCase("clear time")) {
            return "Clear time";
        }
        return trimmed;
    }

    private String writeExtraction(ContributionExtractionResponseDto extraction) {
        try {
            return objectMapper.writeValueAsString(extraction);
        } catch (JsonProcessingException e) {
            LOG.warn("Unable to serialise extraction payload", e);
            return "{}";
        }
    }

    private ContributionExtractionResponseDto readExtraction(String payload) {
        if (payload == null || payload.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(payload, ContributionExtractionResponseDto.class);
        } catch (Exception e) {
            LOG.warn("Unable to deserialise extraction payload", e);
            return null;
        }
    }

    private String encodePicture(byte[] picture) {
        if (picture == null || picture.length == 0) {
            return null;
        }
        String base64 = Base64.getEncoder().encodeToString(picture);
        return String.format(Locale.ROOT, "data:image/png;base64,%s", base64);
    }
}
