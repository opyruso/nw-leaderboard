package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.IndividualRankingEntryResponse;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.entity.RunScore;
import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import com.opyruso.nwleaderboard.entity.RunTime;
import com.opyruso.nwleaderboard.entity.RunTimePlayer;
import com.opyruso.nwleaderboard.repository.RunScorePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScoreRepository;
import com.opyruso.nwleaderboard.repository.RunTimePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunTimeRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.text.Collator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Aggregates individual player rankings based on weekly placements.
 */
@ApplicationScoped
public class IndividualRankingService {

    private static final int MAX_PLACEMENT = 10;

    @Inject
    RunScoreRepository runScoreRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Inject
    RunTimeRepository runTimeRepository;

    @Inject
    RunTimePlayerRepository runTimePlayerRepository;

    public enum Mode {
        GLOBAL,
        SCORE,
        TIME;

        public static Mode fromQuery(String value) {
            if (value == null || value.isBlank()) {
                return GLOBAL;
            }
            try {
                return Mode.valueOf(value.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                return GLOBAL;
            }
        }
    }

    @Transactional(Transactional.TxType.SUPPORTS)
    public List<IndividualRankingEntryResponse> getRanking(Mode mode) {
        Map<Long, String> playerNames = new HashMap<>();
        Map<Long, String> playerRegions = new HashMap<>();

        Map<Long, Map<Integer, Integer>> scorePlacements = computeScorePlacements(playerNames, playerRegions);
        Map<Long, Map<Integer, Integer>> timePlacements = computeTimePlacements(playerNames, playerRegions);

        if (scorePlacements.isEmpty() && timePlacements.isEmpty()) {
            return List.of();
        }

        Map<Long, PlayerPoints> aggregates = new HashMap<>();

        scorePlacements.forEach((playerId, placementsByWeek) -> {
            PlayerPoints points = aggregates.computeIfAbsent(playerId, id -> new PlayerPoints());
            int totalPoints = placementsByWeek.values().stream()
                    .mapToInt(IndividualRankingService::pointsForPlacement)
                    .sum();
            points.scorePoints = totalPoints;
            points.scorePlacements = placementsByWeek;
        });

        timePlacements.forEach((playerId, placementsByWeek) -> {
            PlayerPoints points = aggregates.computeIfAbsent(playerId, id -> new PlayerPoints());
            int totalPoints = placementsByWeek.values().stream()
                    .mapToInt(IndividualRankingService::pointsForPlacement)
                    .sum();
            points.timePoints = totalPoints;
            points.timePlacements = placementsByWeek;
        });

        aggregates.forEach((playerId, points) -> {
            Map<Integer, Integer> scoreByWeek = points.scorePlacements != null ? points.scorePlacements : Map.of();
            Map<Integer, Integer> timeByWeek = points.timePlacements != null ? points.timePlacements : Map.of();
            if (scoreByWeek.isEmpty() && timeByWeek.isEmpty()) {
                points.globalPoints = 0;
                return;
            }
            Set<Integer> weeks = new HashSet<>();
            weeks.addAll(scoreByWeek.keySet());
            weeks.addAll(timeByWeek.keySet());
            int total = 0;
            for (Integer week : weeks) {
                if (week == null) {
                    continue;
                }
                int bestPlacement = Integer.MAX_VALUE;
                Integer scorePlacement = scoreByWeek.get(week);
                if (scorePlacement != null && scorePlacement > 0) {
                    bestPlacement = Math.min(bestPlacement, scorePlacement);
                }
                Integer timePlacement = timeByWeek.get(week);
                if (timePlacement != null && timePlacement > 0) {
                    bestPlacement = Math.min(bestPlacement, timePlacement);
                }
                if (bestPlacement != Integer.MAX_VALUE) {
                    total += pointsForPlacement(bestPlacement);
                }
            }
            points.globalPoints = total;
        });

        List<IndividualRankingEntryResponse> entries = new ArrayList<>(aggregates.size());
        Collator collator = Collator.getInstance(Locale.ENGLISH);
        collator.setStrength(Collator.PRIMARY);

        aggregates.forEach((playerId, points) -> {
            if (playerId == null) {
                return;
            }
            int selectedPoints = switch (mode) {
                case GLOBAL -> points.globalPoints;
                case SCORE -> points.scorePoints;
                case TIME -> points.timePoints;
            };
            if (selectedPoints <= 0) {
                return;
            }
            String playerName = normaliseName(playerNames.get(playerId));
            String regionId = normaliseRegionId(playerRegions.get(playerId));
            entries.add(new IndividualRankingEntryResponse(
                    playerId,
                    playerName,
                    regionId,
                    selectedPoints,
                    points.scorePoints,
                    points.timePoints));
        });

        entries.sort((left, right) -> {
            int comparePoints = Integer.compare(right.points(), left.points());
            if (comparePoints != 0) {
                return comparePoints;
            }
            String leftName = left.playerName() != null ? left.playerName() : "";
            String rightName = right.playerName() != null ? right.playerName() : "";
            int compareNames = collator.compare(leftName, rightName);
            if (compareNames != 0) {
                return compareNames;
            }
            Long leftId = left.playerId();
            Long rightId = right.playerId();
            if (Objects.equals(leftId, rightId)) {
                return 0;
            }
            if (leftId == null) {
                return 1;
            }
            if (rightId == null) {
                return -1;
            }
            return Long.compare(leftId, rightId);
        });

        return List.copyOf(entries);
    }

    private Map<Long, Map<Integer, Integer>> computeScorePlacements(
            Map<Long, String> playerNames, Map<Long, String> playerRegions) {
        List<RunScore> runs = runScoreRepository
                .find("ORDER BY week ASC, score DESC, id ASC")
                .list();
        if (runs.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<Player>> playersByRun = loadPlayersForScoreRuns(runs);
        Map<Integer, List<RunScore>> runsByWeek = new LinkedHashMap<>();
        for (RunScore run : runs) {
            if (run == null) {
                continue;
            }
            Integer week = run.getWeek();
            Integer score = run.getScore();
            if (week == null || score == null) {
                continue;
            }
            runsByWeek.computeIfAbsent(week, unused -> new ArrayList<>()).add(run);
        }
        Map<Long, Map<Integer, Integer>> placements = new HashMap<>();
        runsByWeek.forEach((week, weekRuns) -> {
            if (weekRuns == null || weekRuns.isEmpty()) {
                return;
            }
            weekRuns.sort((left, right) -> {
                int compareScore = Integer.compare(
                        right.getScore() != null ? right.getScore() : Integer.MIN_VALUE,
                        left.getScore() != null ? left.getScore() : Integer.MIN_VALUE);
                if (compareScore != 0) {
                    return compareScore;
                }
                Long leftId = left.getId();
                Long rightId = right.getId();
                if (Objects.equals(leftId, rightId)) {
                    return 0;
                }
                if (leftId == null) {
                    return 1;
                }
                if (rightId == null) {
                    return -1;
                }
                return Long.compare(leftId, rightId);
            });
            int placement = 1;
            for (RunScore run : weekRuns) {
                if (placement > MAX_PLACEMENT) {
                    break;
                }
                if (run == null || run.getId() == null) {
                    placement++;
                    continue;
                }
                List<Player> players = playersByRun.getOrDefault(run.getId(), List.of());
                if (players.isEmpty()) {
                    placement++;
                    continue;
                }
                Set<Long> processed = new HashSet<>();
                for (Player player : players) {
                    Player main = resolveMain(player);
                    if (main == null || main.getId() == null) {
                        continue;
                    }
                    Long mainId = main.getId();
                    if (!processed.add(mainId)) {
                        continue;
                    }
                    playerNames.merge(
                            mainId,
                            normaliseName(main.getPlayerName()),
                            IndividualRankingService::preferNonEmpty);
                    String regionId = normaliseRegionId(
                            main.getRegion() != null ? main.getRegion().getId() : null);
                    if (regionId != null) {
                        playerRegions.putIfAbsent(mainId, regionId);
                    }
                    Map<Integer, Integer> weeks = placements.computeIfAbsent(mainId, unused -> new HashMap<>());
                    weeks.merge(week, placement, Math::min);
                }
                placement++;
            }
        });
        return placements;
    }

    private Map<Long, Map<Integer, Integer>> computeTimePlacements(
            Map<Long, String> playerNames, Map<Long, String> playerRegions) {
        List<RunTime> runs = runTimeRepository
                .find("ORDER BY week ASC, timeInSecond ASC, id ASC")
                .list();
        if (runs.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<Player>> playersByRun = loadPlayersForTimeRuns(runs);
        Map<Integer, List<RunTime>> runsByWeek = new LinkedHashMap<>();
        for (RunTime run : runs) {
            if (run == null) {
                continue;
            }
            Integer week = run.getWeek();
            Integer time = run.getTimeInSecond();
            if (week == null || time == null) {
                continue;
            }
            runsByWeek.computeIfAbsent(week, unused -> new ArrayList<>()).add(run);
        }
        Map<Long, Map<Integer, Integer>> placements = new HashMap<>();
        runsByWeek.forEach((week, weekRuns) -> {
            if (weekRuns == null || weekRuns.isEmpty()) {
                return;
            }
            weekRuns.sort((left, right) -> {
                int compareTime = Integer.compare(
                        left.getTimeInSecond() != null ? left.getTimeInSecond() : Integer.MAX_VALUE,
                        right.getTimeInSecond() != null ? right.getTimeInSecond() : Integer.MAX_VALUE);
                if (compareTime != 0) {
                    return compareTime;
                }
                Long leftId = left.getId();
                Long rightId = right.getId();
                if (Objects.equals(leftId, rightId)) {
                    return 0;
                }
                if (leftId == null) {
                    return 1;
                }
                if (rightId == null) {
                    return -1;
                }
                return Long.compare(leftId, rightId);
            });
            int placement = 1;
            for (RunTime run : weekRuns) {
                if (placement > MAX_PLACEMENT) {
                    break;
                }
                if (run == null || run.getId() == null) {
                    placement++;
                    continue;
                }
                List<Player> players = playersByRun.getOrDefault(run.getId(), List.of());
                if (players.isEmpty()) {
                    placement++;
                    continue;
                }
                Set<Long> processed = new HashSet<>();
                for (Player player : players) {
                    Player main = resolveMain(player);
                    if (main == null || main.getId() == null) {
                        continue;
                    }
                    Long mainId = main.getId();
                    if (!processed.add(mainId)) {
                        continue;
                    }
                    playerNames.merge(
                            mainId,
                            normaliseName(main.getPlayerName()),
                            IndividualRankingService::preferNonEmpty);
                    String regionId = normaliseRegionId(
                            main.getRegion() != null ? main.getRegion().getId() : null);
                    if (regionId != null) {
                        playerRegions.putIfAbsent(mainId, regionId);
                    }
                    Map<Integer, Integer> weeks = placements.computeIfAbsent(mainId, unused -> new HashMap<>());
                    weeks.merge(week, placement, Math::min);
                }
                placement++;
            }
        });
        return placements;
    }

    private Map<Long, List<Player>> loadPlayersForScoreRuns(List<RunScore> runs) {
        List<Long> runIds = runs.stream()
                .filter(Objects::nonNull)
                .map(RunScore::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (runIds.isEmpty()) {
            return Map.of();
        }
        List<RunScorePlayer> associations = runScorePlayerRepository.listWithPlayersByRunIds(runIds);
        Map<Long, LinkedHashMap<Long, Player>> playersByRun = new HashMap<>();
        for (RunScorePlayer association : associations) {
            if (association == null || association.getRunScore() == null || association.getPlayer() == null) {
                continue;
            }
            Long runId = association.getRunScore().getId();
            Player player = association.getPlayer();
            if (runId == null || player.getId() == null) {
                continue;
            }
            LinkedHashMap<Long, Player> bucket = playersByRun.computeIfAbsent(runId, unused -> new LinkedHashMap<>());
            bucket.putIfAbsent(player.getId(), player);
        }
        Map<Long, List<Player>> result = new HashMap<>();
        playersByRun.forEach((runId, bucket) -> result.put(runId, List.copyOf(bucket.values())));
        return result;
    }

    private Map<Long, List<Player>> loadPlayersForTimeRuns(List<RunTime> runs) {
        List<Long> runIds = runs.stream()
                .filter(Objects::nonNull)
                .map(RunTime::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (runIds.isEmpty()) {
            return Map.of();
        }
        List<RunTimePlayer> associations = runTimePlayerRepository.listWithPlayersByRunIds(runIds);
        Map<Long, LinkedHashMap<Long, Player>> playersByRun = new HashMap<>();
        for (RunTimePlayer association : associations) {
            if (association == null || association.getRunTime() == null || association.getPlayer() == null) {
                continue;
            }
            Long runId = association.getRunTime().getId();
            Player player = association.getPlayer();
            if (runId == null || player.getId() == null) {
                continue;
            }
            LinkedHashMap<Long, Player> bucket = playersByRun.computeIfAbsent(runId, unused -> new LinkedHashMap<>());
            bucket.putIfAbsent(player.getId(), player);
        }
        Map<Long, List<Player>> result = new HashMap<>();
        playersByRun.forEach((runId, bucket) -> result.put(runId, List.copyOf(bucket.values())));
        return result;
    }

    private static int pointsForPlacement(int placement) {
        return switch (placement) {
            case 1, 2, 3 -> 6;
            case 4, 5 -> 5;
            case 6, 7 -> 4;
            case 8 -> 3;
            case 9 -> 2;
            case 10 -> 1;
            default -> 0;
        };
    }

    private static String normaliseName(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.strip();
        return trimmed.isEmpty() ? "" : trimmed;
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

    private static String preferNonEmpty(String existing, String candidate) {
        if (existing != null && !existing.isBlank()) {
            return existing;
        }
        return candidate != null ? candidate : "";
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

    private static final class PlayerPoints {
        private int globalPoints;
        private int scorePoints;
        private int timePoints;
        private Map<Integer, Integer> scorePlacements;
        private Map<Integer, Integer> timePlacements;
    }
}
