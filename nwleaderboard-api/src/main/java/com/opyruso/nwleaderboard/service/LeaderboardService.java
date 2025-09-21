package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ScoreLeaderboardEntryResponse;
import com.opyruso.nwleaderboard.dto.TimeLeaderboardEntryResponse;
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
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Domain service responsible for assembling leaderboard responses.
 */
@ApplicationScoped
public class LeaderboardService {

    @Inject
    RunScoreRepository runScoreRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Inject
    RunTimeRepository runTimeRepository;

    @Inject
    RunTimePlayerRepository runTimePlayerRepository;

    /**
     * Retrieves the score leaderboard for the provided dungeon identifier.
     *
     * @param dungeonId identifier of the dungeon
     * @return ordered list of score leaderboard entries
     */
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<ScoreLeaderboardEntryResponse> getScoreLeaderboard(Long dungeonId) {
        if (dungeonId == null) {
            return List.of();
        }

        List<RunScore> runs = runScoreRepository.listByDungeonId(dungeonId).stream()
                .filter(Objects::nonNull)
                .toList();
        if (runs.isEmpty()) {
            return List.of();
        }

        List<Long> runIds = runs.stream()
                .map(RunScore::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, List<String>> playersByRun = runScorePlayerRepository.findPlayerNamesByRunIds(runIds);

        ArrayList<ScoreLeaderboardEntryResponse> responses = new ArrayList<>(runs.size());
        for (RunScore run : runs) {
            Long runId = run.getId();
            if (runId == null) {
                continue;
            }
            Integer score = run.getScore();
            if (score == null) {
                continue;
            }
            Integer week = run.getWeek();
            List<String> players = playersByRun.getOrDefault(runId, List.of());
            responses.add(new ScoreLeaderboardEntryResponse(runId, week, score, players));
        }
        return List.copyOf(responses);
    }

    /**
     * Retrieves the time leaderboard for the provided dungeon identifier.
     *
     * @param dungeonId identifier of the dungeon
     * @return ordered list of time leaderboard entries
     */
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<TimeLeaderboardEntryResponse> getTimeLeaderboard(Long dungeonId) {
        if (dungeonId == null) {
            return List.of();
        }

        List<RunTime> runs = runTimeRepository.listByDungeonId(dungeonId).stream()
                .filter(Objects::nonNull)
                .toList();
        if (runs.isEmpty()) {
            return List.of();
        }

        List<Long> runIds = runs.stream()
                .map(RunTime::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, List<String>> playersByRun = runTimePlayerRepository.findPlayerNamesByRunIds(runIds);

        ArrayList<TimeLeaderboardEntryResponse> responses = new ArrayList<>(runs.size());
        for (RunTime run : runs) {
            Long runId = run.getId();
            if (runId == null) {
                continue;
            }
            Integer time = run.getTimeInSecond();
            if (time == null) {
                continue;
            }
            Integer week = run.getWeek();
            List<String> players = playersByRun.getOrDefault(runId, List.of());
            responses.add(new TimeLeaderboardEntryResponse(runId, week, time, players));
        }
        return List.copyOf(responses);
    }
}
