package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributorRunPlayerResponse;
import com.opyruso.nwleaderboard.dto.ContributorRunReplacementRequest;
import com.opyruso.nwleaderboard.dto.ContributorRunSummaryResponse;
import com.opyruso.nwleaderboard.dto.ContributorRunUpdateRequest;
import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.entity.Region;
import com.opyruso.nwleaderboard.entity.RunScore;
import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import com.opyruso.nwleaderboard.entity.RunScorePlayerId;
import com.opyruso.nwleaderboard.entity.RunTime;
import com.opyruso.nwleaderboard.entity.RunTimePlayer;
import com.opyruso.nwleaderboard.entity.RunTimePlayerId;
import com.opyruso.nwleaderboard.entity.WeekMutationDungeon;
import com.opyruso.nwleaderboard.entity.WeekMutationDungeonId;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScorePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScoreRepository;
import com.opyruso.nwleaderboard.repository.RunTimePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunTimeRepository;
import com.opyruso.nwleaderboard.repository.WeekMutationDungeonRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service exposing contributor operations to search and maintain stored runs.
 */
@ApplicationScoped
public class ContributorRunService {

    private enum RunType {
        SCORE,
        TIME
    }

    @Inject
    RunScoreRepository runScoreRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Inject
    RunTimeRepository runTimeRepository;

    @Inject
    RunTimePlayerRepository runTimePlayerRepository;

    @Inject
    PlayerRepository playerRepository;

    @Inject
    RegionService regionService;

    @Inject
    WeekMutationDungeonRepository weekMutationDungeonRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<ContributorRunSummaryResponse> searchRuns(
            String rawType,
            String rawRegion,
            Integer seasonId,
            Integer week,
            Integer score,
            Integer time,
            List<String> playerFilters,
            Integer limit)
            throws ContributorRunException {
        RunType type = normaliseType(rawType);
        Region region = regionService.resolveRegion(rawRegion);
        List<String> normalisedPlayerFilters = normalisePlayerFilters(playerFilters);
        int safeLimit = limit != null && limit > 0 ? Math.min(limit, 200) : 50;
        int fetchLimit = Math.min(safeLimit * 4, 400);

        return switch (type) {
            case SCORE -> {
                if (time != null) {
                    throw new ContributorRunException(
                            "Time filter is not supported for score runs.", Status.BAD_REQUEST);
                }
                Integer safeWeek = normaliseOptionalPositive(week, "week");
                Integer safeScore = normaliseOptionalPositive(score, "score");
                List<RunScore> runs = runScoreRepository.listRecentRuns(safeWeek, safeScore, region, fetchLimit);
                yield buildScoreSummaries(runs, seasonId, normalisedPlayerFilters, safeLimit);
            }
            case TIME -> {
                if (score != null) {
                    throw new ContributorRunException(
                            "Score filter is not supported for time runs.", Status.BAD_REQUEST);
                }
                Integer safeWeek = normaliseOptionalPositive(week, "week");
                Integer safeTime = normaliseOptionalPositive(time, "time");
                List<RunTime> runs = runTimeRepository.listRecentRuns(safeWeek, safeTime, region, fetchLimit);
                yield buildTimeSummaries(runs, seasonId, normalisedPlayerFilters, safeLimit);
            }
        };
    }

    @Transactional
    public ContributorRunSummaryResponse updateRun(String rawType, Long runId, ContributorRunUpdateRequest request)
            throws ContributorRunException {
        RunType type = normaliseType(rawType);
        if (runId == null) {
            throw new ContributorRunException("Run identifier is required.", Status.BAD_REQUEST);
        }

        return switch (type) {
            case SCORE -> updateScoreRun(runId, request);
            case TIME -> updateTimeRun(runId, request);
        };
    }

    @Transactional
    public void deleteRun(String rawType, Long runId) throws ContributorRunException {
        RunType type = normaliseType(rawType);
        if (runId == null) {
            throw new ContributorRunException("Run identifier is required.", Status.BAD_REQUEST);
        }

        switch (type) {
            case SCORE -> deleteScoreRun(runId);
            case TIME -> deleteTimeRun(runId);
            default -> throw new ContributorRunException("Unsupported run type.", Status.BAD_REQUEST);
        }
    }

    private RunType normaliseType(String rawType) throws ContributorRunException {
        if (rawType == null || rawType.isBlank()) {
            throw new ContributorRunException("Run type is required.", Status.BAD_REQUEST);
        }
        String normalised = rawType.trim().toLowerCase(Locale.ROOT);
        return switch (normalised) {
            case "score" -> RunType.SCORE;
            case "time" -> RunType.TIME;
            default -> throw new ContributorRunException("Unsupported run type.", Status.BAD_REQUEST);
        };
    }

    private Integer normaliseOptionalPositive(Integer value, String field) throws ContributorRunException {
        if (value == null) {
            return null;
        }
        if (value <= 0) {
            throw new ContributorRunException(field + " must be a positive integer.", Status.BAD_REQUEST);
        }
        return value;
    }

    private List<String> normalisePlayerFilters(List<String> rawFilters) {
        if (rawFilters == null || rawFilters.isEmpty()) {
            return List.of();
        }
        Set<String> result = new LinkedHashSet<>();
        for (String filter : rawFilters) {
            if (filter == null) {
                continue;
            }
            String trimmed = filter.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            result.add(trimmed.toLowerCase(Locale.ROOT));
        }
        return List.copyOf(result);
    }

    private List<ContributorRunSummaryResponse> buildScoreSummaries(
            List<RunScore> runs, Integer seasonFilter, List<String> playerFilters, int limit) {
        if (runs == null || runs.isEmpty() || limit <= 0) {
            return List.of();
        }

        Map<Long, List<Player>> playersByRun = loadPlayersForScoreRuns(runs);
        Map<WeekMutationDungeonId, Integer> seasonByKey = loadSeasonsForRuns(runs);

        List<ContributorRunSummaryResponse> summaries = new ArrayList<>(limit);
        for (RunScore run : runs) {
            if (run == null || run.getId() == null) {
                continue;
            }
            WeekMutationDungeonId key = toWeekMutationId(run.getWeek(), run.getDungeon());
            Integer runSeason = key != null ? seasonByKey.get(key) : null;
            if (seasonFilter != null) {
                if (runSeason == null || !seasonFilter.equals(runSeason)) {
                    continue;
                }
            }
            List<Player> players = playersByRun.getOrDefault(run.getId(), List.of());
            if (!matchesPlayerFilters(players, playerFilters)) {
                continue;
            }
            summaries.add(toScoreSummary(run, runSeason, players));
            if (summaries.size() >= limit) {
                break;
            }
        }
        return summaries;
    }

    private List<ContributorRunSummaryResponse> buildTimeSummaries(
            List<RunTime> runs, Integer seasonFilter, List<String> playerFilters, int limit) {
        if (runs == null || runs.isEmpty() || limit <= 0) {
            return List.of();
        }

        Map<Long, List<Player>> playersByRun = loadPlayersForTimeRuns(runs);
        Map<WeekMutationDungeonId, Integer> seasonByKey = loadSeasonsForTimeRuns(runs);

        List<ContributorRunSummaryResponse> summaries = new ArrayList<>(limit);
        for (RunTime run : runs) {
            if (run == null || run.getId() == null) {
                continue;
            }
            WeekMutationDungeonId key = toWeekMutationId(run.getWeek(), run.getDungeon());
            Integer runSeason = key != null ? seasonByKey.get(key) : null;
            if (seasonFilter != null) {
                if (runSeason == null || !seasonFilter.equals(runSeason)) {
                    continue;
                }
            }
            List<Player> players = playersByRun.getOrDefault(run.getId(), List.of());
            if (!matchesPlayerFilters(players, playerFilters)) {
                continue;
            }
            summaries.add(toTimeSummary(run, runSeason, players));
            if (summaries.size() >= limit) {
                break;
            }
        }
        return summaries;
    }

    private Map<Long, List<Player>> loadPlayersForScoreRuns(List<RunScore> runs) {
        List<Long> runIds = runs.stream()
                .filter(Objects::nonNull)
                .map(RunScore::getId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        if (runIds.isEmpty()) {
            return Map.of();
        }
        List<RunScorePlayer> associations = runScorePlayerRepository.listWithPlayersByRunIds(runIds);
        Map<Long, List<Player>> result = new HashMap<>();
        for (RunScorePlayer association : associations) {
            if (association == null || association.getRunScore() == null || association.getPlayer() == null) {
                continue;
            }
            Long runId = association.getRunScore().getId();
            if (runId == null) {
                continue;
            }
            result.computeIfAbsent(runId, key -> new ArrayList<>()).add(association.getPlayer());
        }
        return result;
    }

    private Map<Long, List<Player>> loadPlayersForTimeRuns(List<RunTime> runs) {
        List<Long> runIds = runs.stream()
                .filter(Objects::nonNull)
                .map(RunTime::getId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        if (runIds.isEmpty()) {
            return Map.of();
        }
        List<RunTimePlayer> associations = runTimePlayerRepository.listWithPlayersByRunIds(runIds);
        Map<Long, List<Player>> result = new HashMap<>();
        for (RunTimePlayer association : associations) {
            if (association == null || association.getRunTime() == null || association.getPlayer() == null) {
                continue;
            }
            Long runId = association.getRunTime().getId();
            if (runId == null) {
                continue;
            }
            result.computeIfAbsent(runId, key -> new ArrayList<>()).add(association.getPlayer());
        }
        return result;
    }

    private Map<WeekMutationDungeonId, Integer> loadSeasonsForRuns(List<RunScore> runs) {
        Set<WeekMutationDungeonId> ids = runs.stream()
                .map(run -> toWeekMutationId(run.getWeek(), run.getDungeon()))
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));
        return loadSeasons(ids);
    }

    private Map<WeekMutationDungeonId, Integer> loadSeasonsForTimeRuns(List<RunTime> runs) {
        Set<WeekMutationDungeonId> ids = runs.stream()
                .map(run -> toWeekMutationId(run.getWeek(), run.getDungeon()))
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));
        return loadSeasons(ids);
    }

    private Map<WeekMutationDungeonId, Integer> loadSeasons(Set<WeekMutationDungeonId> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        List<WeekMutationDungeon> entries = weekMutationDungeonRepository.listByIds(ids);
        Map<WeekMutationDungeonId, Integer> result = new HashMap<>();
        for (WeekMutationDungeon entry : entries) {
            if (entry == null || entry.getId() == null || entry.getSeason() == null) {
                continue;
            }
            result.put(entry.getId(), entry.getSeason().getId());
        }
        return result;
    }

    private WeekMutationDungeonId toWeekMutationId(Integer week, Dungeon dungeon) {
        if (week == null || dungeon == null || dungeon.getId() == null) {
            return null;
        }
        return new WeekMutationDungeonId(week, dungeon.getId());
    }

    private boolean matchesPlayerFilters(List<Player> players, List<String> filters) {
        if (filters == null || filters.isEmpty()) {
            return true;
        }
        if (players == null || players.isEmpty()) {
            return false;
        }
        for (String filter : filters) {
            boolean matched = false;
            for (Player player : players) {
                if (player == null || player.getPlayerName() == null) {
                    continue;
                }
                String name = player.getPlayerName().toLowerCase(Locale.ROOT);
                if (name.contains(filter)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                return false;
            }
        }
        return true;
    }

    private ContributorRunSummaryResponse toScoreSummary(
            RunScore run, Integer seasonId, Collection<Player> players) {
        List<ContributorRunPlayerResponse> playerResponses = toPlayerResponses(players);
        String regionId = run.getRegion() != null ? run.getRegion().getId() : null;
        return new ContributorRunSummaryResponse(
                run.getId(),
                "score",
                run.getDungeon() != null ? run.getDungeon().getId() : null,
                resolveDungeonName(run.getDungeon()),
                regionId,
                run.getWeek(),
                seasonId,
                run.getScore(),
                null,
                playerResponses);
    }

    private ContributorRunSummaryResponse toTimeSummary(RunTime run, Integer seasonId, Collection<Player> players) {
        List<ContributorRunPlayerResponse> playerResponses = toPlayerResponses(players);
        String regionId = run.getRegion() != null ? run.getRegion().getId() : null;
        return new ContributorRunSummaryResponse(
                run.getId(),
                "time",
                run.getDungeon() != null ? run.getDungeon().getId() : null,
                resolveDungeonName(run.getDungeon()),
                regionId,
                run.getWeek(),
                seasonId,
                null,
                run.getTimeInSecond(),
                playerResponses);
    }

    private List<ContributorRunPlayerResponse> toPlayerResponses(Collection<Player> players) {
        if (players == null || players.isEmpty()) {
            return List.of();
        }
        List<ContributorRunPlayerResponse> responses = new ArrayList<>(players.size());
        for (Player player : players) {
            if (player == null) {
                continue;
            }
            responses.add(new ContributorRunPlayerResponse(player.getId(), player.getPlayerName()));
        }
        return responses;
    }

    private String resolveDungeonName(Dungeon dungeon) {
        if (dungeon == null) {
            return null;
        }
        String name = dungeon.getNameLocalEn();
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        return dungeon.getId() != null ? String.valueOf(dungeon.getId()) : null;
    }

    private ContributorRunSummaryResponse updateScoreRun(Long runId, ContributorRunUpdateRequest request)
            throws ContributorRunException {
        RunScore run = runScoreRepository.findById(runId);
        if (run == null) {
            throw new ContributorRunException("Run not found.", Status.NOT_FOUND);
        }
        if (request != null) {
            if (request.time() != null) {
                throw new ContributorRunException("Time cannot be provided for score runs.", Status.BAD_REQUEST);
            }
            if (request.week() != null) {
                run.setWeek(normaliseOptionalPositive(request.week(), "week"));
            }
            if (request.region() != null) {
                Region region = regionService.resolveRegion(request.region());
                if (region == null) {
                    throw new ContributorRunException("Unknown region.", Status.BAD_REQUEST);
                }
                run.setRegion(region);
            }
            if (request.score() != null) {
                run.setScore(normaliseOptionalPositive(request.score(), "score"));
            }
            if (request.replacement() != null) {
                replaceScorePlayer(run, request.replacement());
            }
        }
        runScoreRepository.flush();
        List<ContributorRunSummaryResponse> summaries =
                buildScoreSummaries(List.of(run), null, List.of(), 1);
        return summaries.isEmpty() ? null : summaries.get(0);
    }

    private ContributorRunSummaryResponse updateTimeRun(Long runId, ContributorRunUpdateRequest request)
            throws ContributorRunException {
        RunTime run = runTimeRepository.findById(runId);
        if (run == null) {
            throw new ContributorRunException("Run not found.", Status.NOT_FOUND);
        }
        if (request != null) {
            if (request.score() != null) {
                throw new ContributorRunException("Score cannot be provided for time runs.", Status.BAD_REQUEST);
            }
            if (request.week() != null) {
                run.setWeek(normaliseOptionalPositive(request.week(), "week"));
            }
            if (request.region() != null) {
                Region region = regionService.resolveRegion(request.region());
                if (region == null) {
                    throw new ContributorRunException("Unknown region.", Status.BAD_REQUEST);
                }
                run.setRegion(region);
            }
            if (request.time() != null) {
                run.setTimeInSecond(normaliseOptionalPositive(request.time(), "time"));
            }
            if (request.replacement() != null) {
                replaceTimePlayer(run, request.replacement());
            }
        }
        runTimeRepository.flush();
        List<ContributorRunSummaryResponse> summaries =
                buildTimeSummaries(List.of(run), null, List.of(), 1);
        return summaries.isEmpty() ? null : summaries.get(0);
    }

    private void replaceScorePlayer(RunScore run, ContributorRunReplacementRequest replacement)
            throws ContributorRunException {
        if (replacement == null) {
            return;
        }
        Long playerId = replacement.playerId();
        Long replacementId = replacement.replacementPlayerId();
        if (playerId == null || replacementId == null) {
            throw new ContributorRunException(
                    "Both player identifiers are required to perform a replacement.", Status.BAD_REQUEST);
        }
        if (playerId.equals(replacementId)) {
            throw new ContributorRunException(
                    "Replacement player must be different from the original player.", Status.BAD_REQUEST);
        }
        List<RunScorePlayer> associations = runScorePlayerRepository.listByRunId(run.getId());
        RunScorePlayer target = associations.stream()
                .filter(association -> association != null
                        && association.getPlayer() != null
                        && association.getPlayer().getId() != null
                        && association.getPlayer().getId().equals(playerId))
                .findFirst()
                .orElse(null);
        if (target == null) {
            throw new ContributorRunException("The selected player is not part of this run.", Status.BAD_REQUEST);
        }
        for (RunScorePlayer association : associations) {
            if (association != null
                    && association.getPlayer() != null
                    && association.getPlayer().getId() != null
                    && association.getPlayer().getId().equals(replacementId)) {
                throw new ContributorRunException(
                        "The replacement player is already part of this run.", Status.CONFLICT);
            }
        }
        Player replacementPlayer = playerRepository.findById(replacementId);
        if (replacementPlayer == null) {
            throw new ContributorRunException("Replacement player not found.", Status.BAD_REQUEST);
        }
        validateReplacementRegion(run.getRegion(), replacementPlayer);
        RunScorePlayerId id = target.getId();
        if (id == null) {
            id = new RunScorePlayerId();
        }
        id.setRunId(run.getId());
        id.setPlayerId(replacementPlayer.getId());
        target.setId(id);
        target.setPlayer(replacementPlayer);
    }

    private void replaceTimePlayer(RunTime run, ContributorRunReplacementRequest replacement)
            throws ContributorRunException {
        if (replacement == null) {
            return;
        }
        Long playerId = replacement.playerId();
        Long replacementId = replacement.replacementPlayerId();
        if (playerId == null || replacementId == null) {
            throw new ContributorRunException(
                    "Both player identifiers are required to perform a replacement.", Status.BAD_REQUEST);
        }
        if (playerId.equals(replacementId)) {
            throw new ContributorRunException(
                    "Replacement player must be different from the original player.", Status.BAD_REQUEST);
        }
        List<RunTimePlayer> associations = runTimePlayerRepository.listByRunId(run.getId());
        RunTimePlayer target = associations.stream()
                .filter(association -> association != null
                        && association.getPlayer() != null
                        && association.getPlayer().getId() != null
                        && association.getPlayer().getId().equals(playerId))
                .findFirst()
                .orElse(null);
        if (target == null) {
            throw new ContributorRunException("The selected player is not part of this run.", Status.BAD_REQUEST);
        }
        for (RunTimePlayer association : associations) {
            if (association != null
                    && association.getPlayer() != null
                    && association.getPlayer().getId() != null
                    && association.getPlayer().getId().equals(replacementId)) {
                throw new ContributorRunException(
                        "The replacement player is already part of this run.", Status.CONFLICT);
            }
        }
        Player replacementPlayer = playerRepository.findById(replacementId);
        if (replacementPlayer == null) {
            throw new ContributorRunException("Replacement player not found.", Status.BAD_REQUEST);
        }
        validateReplacementRegion(run.getRegion(), replacementPlayer);
        RunTimePlayerId id = target.getId();
        if (id == null) {
            id = new RunTimePlayerId();
        }
        id.setRunId(run.getId());
        id.setPlayerId(replacementPlayer.getId());
        target.setId(id);
        target.setPlayer(replacementPlayer);
    }

    private void validateReplacementRegion(Region runRegion, Player replacementPlayer) throws ContributorRunException {
        if (runRegion == null) {
            throw new ContributorRunException(
                    "Run region must be defined before replacing a player.", Status.BAD_REQUEST);
        }
        String expectedRegion = runRegion.getId();
        String actualRegion =
                replacementPlayer.getRegion() != null ? replacementPlayer.getRegion().getId() : null;
        if (expectedRegion == null || actualRegion == null) {
            throw new ContributorRunException(
                    "Replacement player must belong to the same region as the run.", Status.BAD_REQUEST);
        }
        if (!expectedRegion.equalsIgnoreCase(actualRegion)) {
            throw new ContributorRunException(
                    "Replacement player must belong to the same region as the run.", Status.BAD_REQUEST);
        }
    }

    private void deleteScoreRun(Long runId) throws ContributorRunException {
        RunScore run = runScoreRepository.findById(runId);
        if (run == null) {
            throw new ContributorRunException("Run not found.", Status.NOT_FOUND);
        }
        runScorePlayerRepository.deleteByRunId(runId);
        boolean deleted = runScoreRepository.deleteById(runId);
        runScoreRepository.flush();
        if (!deleted) {
            throw new ContributorRunException("Unable to delete run.", Status.BAD_GATEWAY);
        }
    }

    private void deleteTimeRun(Long runId) throws ContributorRunException {
        RunTime run = runTimeRepository.findById(runId);
        if (run == null) {
            throw new ContributorRunException("Run not found.", Status.NOT_FOUND);
        }
        runTimePlayerRepository.deleteByRunId(runId);
        boolean deleted = runTimeRepository.deleteById(runId);
        runTimeRepository.flush();
        if (!deleted) {
            throw new ContributorRunException("Unable to delete run.", Status.BAD_GATEWAY);
        }
    }

    public static class ContributorRunException extends Exception {
        private final Status status;

        public ContributorRunException(String message, Status status) {
            super(message);
            this.status = status;
        }

        public Status getStatus() {
            return status;
        }
    }
}
