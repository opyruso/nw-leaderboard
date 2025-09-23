package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.LeaderboardEntryResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardPlayerResponse;
import com.opyruso.nwleaderboard.entity.RunScore;
import com.opyruso.nwleaderboard.entity.RunTime;
import com.opyruso.nwleaderboard.repository.RunScorePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScoreRepository;
import com.opyruso.nwleaderboard.repository.RunTimePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunTimeRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Provides read access to leaderboard entries for both score and time modes.
 */
@ApplicationScoped
public class LeaderboardService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;

    @Inject
    RunScoreRepository runScoreRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Inject
    RunTimeRepository runTimeRepository;

    @Inject
    RunTimePlayerRepository runTimePlayerRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<LeaderboardEntryResponse> getScoreEntries(Long dungeonId, Integer limit) {
        if (dungeonId == null) {
            return List.of();
        }
        int safeLimit = sanitiseLimit(limit);
        List<RunScore> runs = runScoreRepository.listTopByDungeon(dungeonId, safeLimit);
        if (runs.isEmpty()) {
            return List.of();
        }
        Map<Long, List<LeaderboardPlayerResponse>> playersByRun = loadPlayersForScoreRuns(runs);
        List<LeaderboardEntryResponse> responses = new ArrayList<>(runs.size());
        for (RunScore run : runs) {
            Long runId = run.getId();
            Integer score = run.getScore();
            responses.add(new LeaderboardEntryResponse(
                    runId,
                    run.getWeek(),
                    score,
                    score,
                    null,
                    playersByRun.getOrDefault(runId, List.of())));
        }
        return List.copyOf(responses);
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<LeaderboardEntryResponse> getTimeEntries(Long dungeonId, Integer limit) {
        if (dungeonId == null) {
            return List.of();
        }
        int safeLimit = sanitiseLimit(limit);
        List<RunTime> runs = runTimeRepository.listTopByDungeon(dungeonId, safeLimit);
        if (runs.isEmpty()) {
            return List.of();
        }
        Map<Long, List<LeaderboardPlayerResponse>> playersByRun = loadPlayersForTimeRuns(runs);
        List<LeaderboardEntryResponse> responses = new ArrayList<>(runs.size());
        for (RunTime run : runs) {
            Long runId = run.getId();
            Integer time = run.getTimeInSecond();
            responses.add(new LeaderboardEntryResponse(
                    runId,
                    run.getWeek(),
                    time,
                    null,
                    time,
                    playersByRun.getOrDefault(runId, List.of())));
        }
        return List.copyOf(responses);
    }

    private Map<Long, List<LeaderboardPlayerResponse>> loadPlayersForScoreRuns(List<RunScore> runs) {
        List<Long> runIds = runs.stream()
                .map(RunScore::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (runIds.isEmpty()) {
            return Map.of();
        }
        List<PlayerAssignment> assignments = runScorePlayerRepository.listWithPlayersByRunIds(runIds).stream()
                .map(association -> new PlayerAssignment(
                        association.getRunScore() != null ? association.getRunScore().getId() : null,
                        association.getPlayer() != null ? association.getPlayer().getId() : null,
                        association.getPlayer() != null ? association.getPlayer().getPlayerName() : null))
                .toList();
        return organisePlayers(runIds, assignments);
    }

    private Map<Long, List<LeaderboardPlayerResponse>> loadPlayersForTimeRuns(List<RunTime> runs) {
        List<Long> runIds = runs.stream()
                .map(RunTime::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (runIds.isEmpty()) {
            return Map.of();
        }
        List<PlayerAssignment> assignments = runTimePlayerRepository.listWithPlayersByRunIds(runIds).stream()
                .map(association -> new PlayerAssignment(
                        association.getRunTime() != null ? association.getRunTime().getId() : null,
                        association.getPlayer() != null ? association.getPlayer().getId() : null,
                        association.getPlayer() != null ? association.getPlayer().getPlayerName() : null))
                .toList();
        return organisePlayers(runIds, assignments);
    }

    private Map<Long, List<LeaderboardPlayerResponse>> organisePlayers(List<Long> runIds, List<PlayerAssignment> assignments) {
        if (runIds.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Long, List<PlayerAssignment>> playersByRun = runIds.stream()
                .collect(Collectors.toMap(id -> id, id -> new ArrayList<>(), (left, right) -> left, LinkedHashMap::new));
        for (PlayerAssignment assignment : assignments) {
            if (assignment == null) {
                continue;
            }
            Long runId = assignment.runId();
            if (runId == null) {
                continue;
            }
            List<PlayerAssignment> bucket = playersByRun.get(runId);
            if (bucket == null) {
                continue;
            }
            bucket.add(assignment);
        }
        LinkedHashMap<Long, List<LeaderboardPlayerResponse>> normalised = new LinkedHashMap<>();
        playersByRun.forEach((runId, players) -> normalised.put(runId, normalisePlayerAssignments(players)));
        return Collections.unmodifiableMap(normalised);
    }

    private List<LeaderboardPlayerResponse> normalisePlayerAssignments(List<PlayerAssignment> assignments) {
        if (assignments == null || assignments.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, LeaderboardPlayerResponse> unique = new LinkedHashMap<>();
        for (PlayerAssignment assignment : assignments) {
            if (assignment == null) {
                continue;
            }
            Long playerId = assignment.playerId();
            String name = assignment.playerName();
            String trimmed = name != null ? name.strip() : null;
            if ((playerId == null || playerId < 0) && (trimmed == null || trimmed.isEmpty())) {
                continue;
            }
            String key = playerId != null ? "id:" + playerId : "name:" + trimmed.toLowerCase(Locale.ROOT);
            unique.putIfAbsent(key, new LeaderboardPlayerResponse(playerId, trimmed));
        }
        return List.copyOf(unique.values());
    }

    private int sanitiseLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    private record PlayerAssignment(Long runId, Long playerId, String playerName) {
    }
}
