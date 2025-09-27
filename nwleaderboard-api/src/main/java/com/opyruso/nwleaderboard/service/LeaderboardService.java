package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.HighlightMetricResponse;
import com.opyruso.nwleaderboard.dto.HighlightResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardEntryResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardPageResponse;
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
import java.util.LinkedHashSet;
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

    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final int MAX_PAGE_SIZE = 100;

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
    public LeaderboardPageResponse getScoreEntries(
            Long dungeonId,
            Integer pageParam,
            Integer pageSizeParam,
            List<String> mutationTypeIds,
            List<String> mutationPromotionIds,
            List<String> mutationCurseIds,
            List<String> regionIds) {
        int safePageSize = sanitisePageSize(pageSizeParam);
        int requestedPage = sanitisePage(pageParam);
        if (dungeonId == null) {
            return new LeaderboardPageResponse(List.of(), 0L, 1, safePageSize, 1);
        }

        MutationFilter filter = sanitiseMutationFilter(mutationTypeIds, mutationPromotionIds, mutationCurseIds);
        Set<String> regionFilter = sanitiseRegionIds(regionIds);
        List<Integer> weekFilter = resolveWeekFilter(dungeonId, filter);
        if (weekFilter != null && weekFilter.isEmpty()) {
            return new LeaderboardPageResponse(List.of(), 0L, 1, safePageSize, 1);
        }

        long totalRuns = runScoreRepository.countByDungeonAndWeeks(dungeonId, weekFilter, regionFilter);
        int totalPages = computeTotalPages(totalRuns, safePageSize);
        int safePage = clampPage(requestedPage, totalPages);
        if (totalRuns == 0) {
            return new LeaderboardPageResponse(List.of(), 0L, safePage, safePageSize, totalPages);
        }

        List<RunScore> runs =
                runScoreRepository.listByDungeonAndWeeks(dungeonId, weekFilter, regionFilter, safePage - 1, safePageSize);
        Map<Long, List<LeaderboardPlayerResponse>> playersByRun = loadPlayersForScoreRuns(runs);
        Map<MutationKey, MutationIds> mutationCache = new HashMap<>();
        List<LeaderboardEntryResponse> responses = new ArrayList<>(runs.size());
        int startIndex = (safePage - 1) * safePageSize;
        for (int index = 0; index < runs.size(); index++) {
            RunScore run = runs.get(index);
            if (run == null) {
                continue;
            }
            Long runId = run.getId();
            MutationIds mutationIds = resolveMutationIds(run.getWeek(), run.getDungeon(), mutationCache);
            int position = startIndex + index + 1;
            String regionId = normaliseRegionId(run.getRegion() != null ? run.getRegion().getId() : null);
            responses.add(new LeaderboardEntryResponse(
                    runId,
                    position,
                    run.getWeek(),
                    regionId,
                    run.getScore(),
                    run.getScore(),
                    null,
                    playersByRun.getOrDefault(runId, List.of()),
                    mutationIds.typeId(),
                    mutationIds.promotionId(),
                    mutationIds.curseId()));
        }
        return new LeaderboardPageResponse(responses, totalRuns, safePage, safePageSize, totalPages);
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public LeaderboardPageResponse getTimeEntries(
            Long dungeonId,
            Integer pageParam,
            Integer pageSizeParam,
            List<String> mutationTypeIds,
            List<String> mutationPromotionIds,
            List<String> mutationCurseIds,
            List<String> regionIds) {
        int safePageSize = sanitisePageSize(pageSizeParam);
        int requestedPage = sanitisePage(pageParam);
        if (dungeonId == null) {
            return new LeaderboardPageResponse(List.of(), 0L, 1, safePageSize, 1);
        }

        MutationFilter filter = sanitiseMutationFilter(mutationTypeIds, mutationPromotionIds, mutationCurseIds);
        Set<String> regionFilter = sanitiseRegionIds(regionIds);
        List<Integer> weekFilter = resolveWeekFilter(dungeonId, filter);
        if (weekFilter != null && weekFilter.isEmpty()) {
            return new LeaderboardPageResponse(List.of(), 0L, 1, safePageSize, 1);
        }

        long totalRuns = runTimeRepository.countByDungeonAndWeeks(dungeonId, weekFilter, regionFilter);
        int totalPages = computeTotalPages(totalRuns, safePageSize);
        int safePage = clampPage(requestedPage, totalPages);
        if (totalRuns == 0) {
            return new LeaderboardPageResponse(List.of(), 0L, safePage, safePageSize, totalPages);
        }

        List<RunTime> runs =
                runTimeRepository.listByDungeonAndWeeks(dungeonId, weekFilter, regionFilter, safePage - 1, safePageSize);
        Map<Long, List<LeaderboardPlayerResponse>> playersByRun = loadPlayersForTimeRuns(runs);
        Map<MutationKey, MutationIds> mutationCache = new HashMap<>();
        List<LeaderboardEntryResponse> responses = new ArrayList<>(runs.size());
        int startIndex = (safePage - 1) * safePageSize;
        for (int index = 0; index < runs.size(); index++) {
            RunTime run = runs.get(index);
            if (run == null) {
                continue;
            }
            Long runId = run.getId();
            MutationIds mutationIds = resolveMutationIds(run.getWeek(), run.getDungeon(), mutationCache);
            int position = startIndex + index + 1;
            Integer time = run.getTimeInSecond();
            String regionId = normaliseRegionId(run.getRegion() != null ? run.getRegion().getId() : null);
            responses.add(new LeaderboardEntryResponse(
                    runId,
                    position,
                    run.getWeek(),
                    regionId,
                    time,
                    null,
                    time,
                    playersByRun.getOrDefault(runId, List.of()),
                    mutationIds.typeId(),
                    mutationIds.promotionId(),
                    mutationIds.curseId()));
        }
        return new LeaderboardPageResponse(responses, totalRuns, safePage, safePageSize, totalPages);
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

    private String normaliseName(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normaliseRegionId(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.toUpperCase(Locale.ROOT);
    }

    private Set<String> sanitiseRegionIds(List<String> regionIds) {
        if (regionIds == null) {
            return Set.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : regionIds) {
            String normalised = normaliseRegionId(value);
            if (normalised != null) {
                unique.add(normalised);
            }
        }
        return unique.isEmpty() ? Set.of() : Collections.unmodifiableSet(unique);
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

    private MutationFilter sanitiseMutationFilter(
            List<String> typeIds, List<String> promotionIds, List<String> curseIds) {
        Set<String> typeSet = sanitiseMutationIds(typeIds);
        Set<String> promotionSet = sanitiseMutationIds(promotionIds);
        Set<String> curseSet = sanitiseMutationIds(curseIds);

        boolean typeRequested = typeIds != null && !typeSet.isEmpty();
        boolean promotionRequested = promotionIds != null && !promotionSet.isEmpty();
        boolean curseRequested = curseIds != null && !curseSet.isEmpty();

        Set<String> safeTypeSet = typeRequested ? typeSet : Set.of();
        Set<String> safePromotionSet = promotionRequested ? promotionSet : Set.of();
        Set<String> safeCurseSet = curseRequested ? curseSet : Set.of();

        return new MutationFilter(
                safeTypeSet, safePromotionSet, safeCurseSet, typeRequested, promotionRequested, curseRequested);
    }

    private Set<String> sanitiseMutationIds(List<String> values) {
        if (values == null) {
            return Set.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null) {
                continue;
            }
            String trimmed = value.trim();
            if (!trimmed.isEmpty()) {
                unique.add(trimmed);
            }
        }
        return unique.isEmpty() ? Set.of() : Collections.unmodifiableSet(unique);
    }

    private List<Integer> resolveWeekFilter(Long dungeonId, MutationFilter filter) {
        if (filter == null || !filter.hasAnyRequestedFilter()) {
            return null;
        }
        if ((filter.typeFilterRequested() && filter.typeIds().isEmpty())
                || (filter.promotionFilterRequested() && filter.promotionIds().isEmpty())
                || (filter.curseFilterRequested() && filter.curseIds().isEmpty())) {
            return List.of();
        }
        return weekMutationDungeonRepository.findWeekNumbersByFilters(
                dungeonId,
                filter.typeFilterRequested() ? filter.typeIds() : null,
                filter.promotionFilterRequested() ? filter.promotionIds() : null,
                filter.curseFilterRequested() ? filter.curseIds() : null);
    }

    private int sanitisePage(Integer page) {
        if (page == null || page < 1) {
            return 1;
        }
        return page;
    }

    private int sanitisePageSize(Integer pageSize) {
        if (pageSize == null || pageSize <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private int computeTotalPages(long totalEntries, int pageSize) {
        if (pageSize <= 0) {
            return 1;
        }
        if (totalEntries <= 0) {
            return 1;
        }
        long pages = (totalEntries + pageSize - 1) / pageSize;
        return pages >= Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) pages;
    }

    private int clampPage(int requestedPage, int totalPages) {
        if (totalPages <= 0) {
            return 1;
        }
        if (requestedPage < 1) {
            return 1;
        }
        return Math.min(requestedPage, totalPages);
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

    private record MutationFilter(
            Set<String> typeIds,
            Set<String> promotionIds,
            Set<String> curseIds,
            boolean typeFilterRequested,
            boolean promotionFilterRequested,
            boolean curseFilterRequested) {

        boolean hasAnyRequestedFilter() {
            return typeFilterRequested || promotionFilterRequested || curseFilterRequested;
        }
    }

    private record PlayerAssignment(
            Long runId, Long playerId, String playerName, Long mainPlayerId, String mainPlayerName) {
    }
}
