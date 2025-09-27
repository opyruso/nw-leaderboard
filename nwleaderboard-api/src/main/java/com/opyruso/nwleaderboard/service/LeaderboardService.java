package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.HighlightMetricResponse;
import com.opyruso.nwleaderboard.dto.HighlightResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardEntryResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardPlayerResponse;
import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.entity.RunScore;
import com.opyruso.nwleaderboard.entity.RunTime;
import com.opyruso.nwleaderboard.entity.WeekMutationDungeon;
import com.opyruso.nwleaderboard.repository.DungeonRepository;
import com.opyruso.nwleaderboard.repository.RunScorePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScoreRepository;
import com.opyruso.nwleaderboard.repository.RunTimePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunTimeRepository;
import com.opyruso.nwleaderboard.repository.WeekMutationDungeonRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.text.Collator;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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

    @Inject
    DungeonRepository dungeonRepository;

    @Inject
    WeekMutationDungeonRepository weekMutationDungeonRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<LeaderboardEntryResponse> getScoreEntries(Long dungeonId, Integer limit) {
        if (dungeonId == null) {
            return List.of();
        }
        int safeLimit = sanitiseLimit(limit);
        List<RunScore> candidateRuns = collectScoreRuns(dungeonId, safeLimit);
        if (candidateRuns.isEmpty()) {
            return List.of();
        }
        Map<Long, List<LeaderboardPlayerResponse>> playersByRun = loadPlayersForScoreRuns(candidateRuns);
        List<RunScore> runs = filterScoreRuns(candidateRuns, playersByRun, safeLimit);
        if (runs.isEmpty()) {
            return List.of();
        }
        Map<Long, List<LeaderboardPlayerResponse>> filteredPlayers = new LinkedHashMap<>();
        for (RunScore run : runs) {
            if (run == null || run.getId() == null) {
                continue;
            }
            filteredPlayers.put(run.getId(), playersByRun.getOrDefault(run.getId(), List.of()));
        }
        Map<MutationKey, MutationIds> mutationCache = new HashMap<>();
        List<LeaderboardEntryResponse> responses = new ArrayList<>(runs.size());
        for (int index = 0; index < runs.size(); index++) {
            RunScore run = runs.get(index);
            Long runId = run.getId();
            Integer score = run.getScore();
            Integer position = index + 1;
            MutationIds mutationIds = resolveMutationIds(run.getWeek(), run.getDungeon(), mutationCache);
            responses.add(new LeaderboardEntryResponse(
                    runId,
                    position,
                    run.getWeek(),
                    score,
                    score,
                    null,
                    filteredPlayers.getOrDefault(runId, List.of()),
                    mutationIds.typeId(),
                    mutationIds.promotionId(),
                    mutationIds.curseId()));
        }
        return List.copyOf(responses);
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<LeaderboardEntryResponse> getTimeEntries(Long dungeonId, Integer limit) {
        if (dungeonId == null) {
            return List.of();
        }
        int safeLimit = sanitiseLimit(limit);
        List<RunTime> candidateRuns = collectTimeRuns(dungeonId, safeLimit);
        if (candidateRuns.isEmpty()) {
            return List.of();
        }
        Map<Long, List<LeaderboardPlayerResponse>> playersByRun = loadPlayersForTimeRuns(candidateRuns);
        List<RunTime> runs = filterTimeRuns(candidateRuns, playersByRun, safeLimit);
        if (runs.isEmpty()) {
            return List.of();
        }
        Map<Long, List<LeaderboardPlayerResponse>> filteredPlayers = new LinkedHashMap<>();
        for (RunTime run : runs) {
            if (run == null || run.getId() == null) {
                continue;
            }
            filteredPlayers.put(run.getId(), playersByRun.getOrDefault(run.getId(), List.of()));
        }
        Map<MutationKey, MutationIds> mutationCache = new HashMap<>();
        List<LeaderboardEntryResponse> responses = new ArrayList<>(runs.size());
        for (int index = 0; index < runs.size(); index++) {
            RunTime run = runs.get(index);
            Long runId = run.getId();
            Integer time = run.getTimeInSecond();
            Integer position = index + 1;
            MutationIds mutationIds = resolveMutationIds(run.getWeek(), run.getDungeon(), mutationCache);
            responses.add(new LeaderboardEntryResponse(
                    runId,
                    position,
                    run.getWeek(),
                    time,
                    null,
                    time,
                    filteredPlayers.getOrDefault(runId, List.of()),
                    mutationIds.typeId(),
                    mutationIds.promotionId(),
                    mutationIds.curseId()));
        }
        return List.copyOf(responses);
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<HighlightResponse> getHighlights() {
        List<Dungeon> highlighted = dungeonRepository.listHighlighted();
        if (highlighted.isEmpty()) {
            return List.of();
        }

        LinkedHashMap<Long, RunScore> bestScoresByDungeon = new LinkedHashMap<>();
        LinkedHashMap<Long, RunTime> bestTimesByDungeon = new LinkedHashMap<>();
        List<RunScore> scoreRuns = new ArrayList<>();
        List<RunTime> timeRuns = new ArrayList<>();
        Map<MutationKey, MutationIds> mutationCache = new HashMap<>();

        for (Dungeon dungeon : highlighted) {
            if (dungeon == null || dungeon.getId() == null) {
                continue;
            }
            Long dungeonId = dungeon.getId();
            RunScore bestScore = runScoreRepository.findBestByDungeon(dungeonId);
            if (bestScore != null) {
                bestScoresByDungeon.put(dungeonId, bestScore);
                scoreRuns.add(bestScore);
            }
            RunTime bestTime = runTimeRepository.findBestByDungeon(dungeonId);
            if (bestTime != null) {
                bestTimesByDungeon.put(dungeonId, bestTime);
                timeRuns.add(bestTime);
            }
        }

        Map<Long, List<LeaderboardPlayerResponse>> scorePlayersByRun = loadPlayersForScoreRuns(scoreRuns);
        Map<Long, List<LeaderboardPlayerResponse>> timePlayersByRun = loadPlayersForTimeRuns(timeRuns);

        List<HighlightResponse> responses = new ArrayList<>();
        for (Dungeon dungeon : highlighted) {
            if (dungeon == null || dungeon.getId() == null) {
                continue;
            }
            Long dungeonId = dungeon.getId();
            RunScore bestScore = bestScoresByDungeon.get(dungeonId);
            RunTime bestTime = bestTimesByDungeon.get(dungeonId);
            MutationIds scoreMutations = resolveMutationIds(
                    bestScore != null ? bestScore.getWeek() : null,
                    bestScore != null ? bestScore.getDungeon() : null,
                    mutationCache);
            Integer scorePosition = bestScore != null ? runScoreRepository.findPositionInDungeon(bestScore) : null;
            HighlightMetricResponse scoreMetric = bestScore != null
                    ? new HighlightMetricResponse(
                            bestScore.getScore(),
                            bestScore.getWeek(),
                            scorePosition,
                            scorePlayersByRun.getOrDefault(bestScore.getId(), List.of()),
                            scoreMutations.typeId(),
                            scoreMutations.promotionId(),
                            scoreMutations.curseId())
                    : null;
            MutationIds timeMutations = resolveMutationIds(
                    bestTime != null ? bestTime.getWeek() : null,
                    bestTime != null ? bestTime.getDungeon() : null,
                    mutationCache);
            Integer timePosition = bestTime != null ? runTimeRepository.findPositionInDungeon(bestTime) : null;
            HighlightMetricResponse timeMetric = bestTime != null
                    ? new HighlightMetricResponse(
                            bestTime.getTimeInSecond(),
                            bestTime.getWeek(),
                            timePosition,
                            timePlayersByRun.getOrDefault(bestTime.getId(), List.of()),
                            timeMutations.typeId(),
                            timeMutations.promotionId(),
                            timeMutations.curseId())
                    : null;
            Map<String, String> names = buildNameMap(dungeon);
            String fallbackName = names.getOrDefault("en", valueOrEmpty(dungeon.getNameLocalEn()));
            responses.add(new HighlightResponse(dungeonId, fallbackName, names, dungeon.getPlayerCount(), scoreMetric, timeMetric));
        }

        Collator collator = Collator.getInstance(Locale.ENGLISH);
        collator.setStrength(Collator.PRIMARY);
        responses.sort((left, right) -> {
            String leftName = left.name() != null ? left.name() : "";
            String rightName = right.name() != null ? right.name() : "";
            return collator.compare(leftName, rightName);
        });
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
                .map(association -> toAssignment(
                        association.getRunScore() != null ? association.getRunScore().getId() : null,
                        association.getPlayer()))
                .filter(Objects::nonNull)
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
                .map(association -> toAssignment(
                        association.getRunTime() != null ? association.getRunTime().getId() : null,
                        association.getPlayer()))
                .filter(Objects::nonNull)
                .toList();
        return organisePlayers(runIds, assignments);
    }

    private PlayerAssignment toAssignment(Long runId, Player player) {
        if (runId == null || player == null) {
            return null;
        }
        Long playerId = player.getId();
        String playerName = normaliseName(player.getPlayerName());
        Player main = resolveMain(player);
        Long mainId = main != null && !Objects.equals(main.getId(), playerId) ? main.getId() : null;
        String mainName = main != null && !Objects.equals(main.getId(), playerId)
                ? normaliseName(main.getPlayerName())
                : null;
        return new PlayerAssignment(runId, playerId, playerName, mainId, mainName);
    }

    private List<RunScore> collectScoreRuns(Long dungeonId, int limit) {
        if (dungeonId == null || limit <= 0) {
            return List.of();
        }
        int pageSize = Math.max(limit, 25);
        int maxPages = 10;
        List<RunScore> collected = new ArrayList<>();
        for (int page = 0; page < maxPages; page++) {
            List<RunScore> pageRuns =
                    runScoreRepository.listTopByDungeonPaged(dungeonId, page, pageSize);
            if (pageRuns.isEmpty()) {
                break;
            }
            collected.addAll(pageRuns);
            if (collected.size() >= limit * 3L) {
                break;
            }
        }
        return collected;
    }

    private List<RunTime> collectTimeRuns(Long dungeonId, int limit) {
        if (dungeonId == null || limit <= 0) {
            return List.of();
        }
        int pageSize = Math.max(limit, 25);
        int maxPages = 10;
        List<RunTime> collected = new ArrayList<>();
        for (int page = 0; page < maxPages; page++) {
            List<RunTime> pageRuns =
                    runTimeRepository.listTopByDungeonPaged(dungeonId, page, pageSize);
            if (pageRuns.isEmpty()) {
                break;
            }
            collected.addAll(pageRuns);
            if (collected.size() >= limit * 3L) {
                break;
            }
        }
        return collected;
    }

    private List<RunScore> filterScoreRuns(
            List<RunScore> runs, Map<Long, List<LeaderboardPlayerResponse>> playersByRun, int limit) {
        if (runs == null || runs.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<RunScore> filtered = new ArrayList<>();
        Set<String> seenTeams = new HashSet<>();
        for (RunScore run : runs) {
            if (run == null || run.getId() == null) {
                continue;
            }
            String teamKey = buildTeamKey(playersByRun.getOrDefault(run.getId(), List.of()));
            if (teamKey.isEmpty()) {
                teamKey = "run:" + run.getId();
            }
            if (!seenTeams.add(teamKey)) {
                continue;
            }
            filtered.add(run);
            if (filtered.size() >= limit) {
                break;
            }
        }
        return filtered;
    }

    private List<RunTime> filterTimeRuns(
            List<RunTime> runs, Map<Long, List<LeaderboardPlayerResponse>> playersByRun, int limit) {
        if (runs == null || runs.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<RunTime> filtered = new ArrayList<>();
        Set<String> seenTeams = new HashSet<>();
        for (RunTime run : runs) {
            if (run == null || run.getId() == null) {
                continue;
            }
            String teamKey = buildTeamKey(playersByRun.getOrDefault(run.getId(), List.of()));
            if (teamKey.isEmpty()) {
                teamKey = "run:" + run.getId();
            }
            if (!seenTeams.add(teamKey)) {
                continue;
            }
            filtered.add(run);
            if (filtered.size() >= limit) {
                break;
            }
        }
        return filtered;
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
            if ((playerId == null || playerId < 0) && (name == null || name.isEmpty())) {
                continue;
            }
            String key = playerId != null
                    ? "id:" + playerId
                    : "name:" + name.toLowerCase(Locale.ROOT);
            unique.putIfAbsent(
                    key,
                    new LeaderboardPlayerResponse(
                            playerId,
                            name,
                            assignment.mainPlayerId(),
                            assignment.mainPlayerName()));
        }
        return List.copyOf(unique.values());
    }

    private String buildTeamKey(List<LeaderboardPlayerResponse> players) {
        if (players == null || players.isEmpty()) {
            return "";
        }
        Set<String> identifiers = new HashSet<>();
        for (LeaderboardPlayerResponse player : players) {
            if (player == null) {
                continue;
            }
            Long canonicalId = player.mainPlayerId() != null ? player.mainPlayerId() : player.playerId();
            if (canonicalId != null) {
                identifiers.add("id:" + canonicalId);
                continue;
            }
            String canonicalName = player.mainPlayerName() != null ? player.mainPlayerName() : player.playerName();
            String normalised = normaliseName(canonicalName);
            if (normalised != null) {
                identifiers.add("name:" + normalised.toLowerCase(Locale.ROOT));
            }
        }
        if (identifiers.isEmpty()) {
            return "";
        }
        List<String> sorted = new ArrayList<>(identifiers);
        sorted.sort(String::compareTo);
        return String.join("|", sorted);
    }

    private String normaliseName(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Player resolveMain(Player player) {
        if (player == null) {
            return null;
        }
        Player current = player;
        Set<Long> visited = new HashSet<>();
        while (current.getMainCharacter() != null) {
            if (current.getId() != null && !visited.add(current.getId())) {
                break;
            }
            Player next = current.getMainCharacter();
            if (next == null || next.equals(current)) {
                break;
            }
            current = next;
        }
        return current;
    }

    private int sanitiseLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    private Map<String, String> buildNameMap(Dungeon dungeon) {
        if (dungeon == null) {
            return Map.of();
        }
        Map<String, String> names = new LinkedHashMap<>();
        names.put("en", valueOrEmpty(dungeon.getNameLocalEn()));
        names.put("de", valueOrEmpty(dungeon.getNameLocalDe()));
        names.put("fr", valueOrEmpty(dungeon.getNameLocalFr()));
        names.put("es", valueOrEmpty(dungeon.getNameLocalEs()));
        names.put("esmx", valueOrEmpty(dungeon.getNameLocalEsmx()));
        names.put("it", valueOrEmpty(dungeon.getNameLocalIt()));
        names.put("pl", valueOrEmpty(dungeon.getNameLocalPl()));
        names.put("pt", valueOrEmpty(dungeon.getNameLocalPt()));
        return Map.copyOf(names);
    }

    private String valueOrEmpty(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private MutationIds resolveMutationIds(Integer week, Dungeon dungeon, Map<MutationKey, MutationIds> cache) {
        if (week == null || dungeon == null || dungeon.getId() == null) {
            return MutationIds.EMPTY;
        }
        MutationKey key = new MutationKey(week, dungeon.getId());
        return cache.computeIfAbsent(key, mutationKey -> {
            WeekMutationDungeon mutation =
                    weekMutationDungeonRepository.findByIds(mutationKey.week(), mutationKey.dungeonId());
            if (mutation == null) {
                return MutationIds.EMPTY;
            }
            String typeId = mutation.getMutationType() != null ? mutation.getMutationType().getId() : null;
            String promotionId = mutation.getMutationPromotion() != null ? mutation.getMutationPromotion().getId() : null;
            String curseId = mutation.getMutationCurse() != null ? mutation.getMutationCurse().getId() : null;
            if (typeId == null && promotionId == null && curseId == null) {
                return MutationIds.EMPTY;
            }
            return new MutationIds(typeId, promotionId, curseId);
        });
    }

    private record MutationKey(Integer week, Long dungeonId) {
    }

    private record MutationIds(String typeId, String promotionId, String curseId) {
        private static final MutationIds EMPTY = new MutationIds(null, null, null);
    }

    private record PlayerAssignment(
            Long runId, Long playerId, String playerName, Long mainPlayerId, String mainPlayerName) {
    }
}
