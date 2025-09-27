package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.PlayerDungeonBestResponse;
import com.opyruso.nwleaderboard.dto.PlayerProfileResponse;
import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.entity.RunScore;
import com.opyruso.nwleaderboard.entity.RunTime;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScoreRepository;
import com.opyruso.nwleaderboard.repository.RunTimeRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.text.Collator;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Aggregates leaderboard information for a single player.
 */
@ApplicationScoped
public class PlayerProfileService {

    @Inject
    PlayerRepository playerRepository;

    @Inject
    RunScoreRepository runScoreRepository;

    @Inject
    RunTimeRepository runTimeRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<PlayerProfileResponse> getProfile(Long playerId) {
        if (playerId == null) {
            return Optional.empty();
        }
        Player player = playerRepository.findById(playerId);
        if (player == null) {
            return Optional.empty();
        }

        LinkedHashMap<Long, PlayerDungeonAggregate> aggregates = new LinkedHashMap<>();

        List<RunScore> scoreRuns = runScoreRepository.listBestByPlayer(playerId);
        for (RunScore run : scoreRuns) {
            if (run == null) {
                continue;
            }
            Dungeon dungeon = run.getDungeon();
            Long dungeonId = dungeon != null ? dungeon.getId() : null;
            if (dungeonId == null) {
                continue;
            }
            PlayerDungeonAggregate aggregate =
                    aggregates.computeIfAbsent(dungeonId, id -> new PlayerDungeonAggregate(dungeon));
            if (aggregate.bestScore == null) {
                aggregate.bestScore = run;
            }
        }

        List<RunTime> timeRuns = runTimeRepository.listBestByPlayer(playerId);
        for (RunTime run : timeRuns) {
            if (run == null) {
                continue;
            }
            Dungeon dungeon = run.getDungeon();
            Long dungeonId = dungeon != null ? dungeon.getId() : null;
            if (dungeonId == null) {
                continue;
            }
            PlayerDungeonAggregate aggregate =
                    aggregates.computeIfAbsent(dungeonId, id -> new PlayerDungeonAggregate(dungeon));
            if (aggregate.bestTime == null) {
                aggregate.bestTime = run;
            }
        }

        Map<Long, Integer> minScores = runScoreRepository.findMinimumScoresByDungeonIds(aggregates.keySet());
        Map<Long, Integer> maxScores = runScoreRepository.findMaximumScoresByDungeonIds(aggregates.keySet());
        Map<Long, Integer> minTimes = runTimeRepository.findMinimumTimesByDungeonIds(aggregates.keySet());
        Map<Long, Integer> maxTimes = runTimeRepository.findMaximumTimesByDungeonIds(aggregates.keySet());

        for (Map.Entry<Long, PlayerDungeonAggregate> entry : aggregates.entrySet()) {
            if (entry == null) {
                continue;
            }
            Long dungeonId = entry.getKey();
            PlayerDungeonAggregate aggregate = entry.getValue();
            if (dungeonId == null || aggregate == null) {
                continue;
            }
            aggregate.minScore = minScores.get(dungeonId);
            aggregate.maxScore = maxScores.get(dungeonId);
            aggregate.minTime = minTimes.get(dungeonId);
            aggregate.maxTime = maxTimes.get(dungeonId);
        }

        List<PlayerDungeonBestResponse> dungeonSummaries = buildDungeonSummaries(aggregates);

        Player main = resolveMain(player);
        Long mainId = main != null && !main.equals(player) ? main.getId() : null;
        String mainName = main != null && !main.equals(player) ? main.getPlayerName() : null;
        String regionId = normaliseRegionId(player.getRegion() != null ? player.getRegion().getId() : null);
        PlayerProfileResponse response = new PlayerProfileResponse(
                player.getId(), player.getPlayerName(), regionId, mainId, mainName, dungeonSummaries);
        return Optional.of(response);
    }

    private List<PlayerDungeonBestResponse> buildDungeonSummaries(Map<Long, PlayerDungeonAggregate> aggregates) {
        if (aggregates == null || aggregates.isEmpty()) {
            return List.of();
        }
        List<PlayerDungeonBestResponse> summaries = new ArrayList<>(aggregates.size());
        for (PlayerDungeonAggregate aggregate : aggregates.values()) {
            if (aggregate == null || aggregate.dungeon == null || aggregate.dungeon.getId() == null) {
                continue;
            }
            summaries.add(createSummary(aggregate));
        }
        Collator collator = Collator.getInstance(Locale.ENGLISH);
        collator.setStrength(Collator.PRIMARY);
        summaries.sort((left, right) -> {
            String leftName = left.fallbackName() != null ? left.fallbackName() : "";
            String rightName = right.fallbackName() != null ? right.fallbackName() : "";
            return collator.compare(leftName, rightName);
        });
        return List.copyOf(summaries);
    }

    private PlayerDungeonBestResponse createSummary(PlayerDungeonAggregate aggregate) {
        Dungeon dungeon = aggregate.dungeon;
        Map<String, String> names = buildNameMap(dungeon);
        String fallbackName = names.getOrDefault("en", valueOrEmpty(dungeon != null ? dungeon.getNameLocalEn() : null));
        RunScore bestScore = aggregate.bestScore;
        RunTime bestTime = aggregate.bestTime;
        Integer scoreValue = bestScore != null ? bestScore.getScore() : null;
        Integer scoreWeek = bestScore != null ? bestScore.getWeek() : null;
        Integer scorePosition = bestScore != null ? runScoreRepository.findPositionInDungeon(bestScore) : null;
        Integer minScore = aggregate.minScore;
        Integer maxScore = aggregate.maxScore;
        Integer timeValue = bestTime != null ? bestTime.getTimeInSecond() : null;
        Integer timeWeek = bestTime != null ? bestTime.getWeek() : null;
        Integer timePosition = bestTime != null ? runTimeRepository.findPositionInDungeon(bestTime) : null;
        Integer minTime = aggregate.minTime;
        Integer maxTime = aggregate.maxTime;
        Long dungeonId = dungeon != null ? dungeon.getId() : null;
        return new PlayerDungeonBestResponse(
                dungeonId,
                fallbackName,
                names,
                scoreValue,
                scoreWeek,
                scorePosition,
                minScore,
                maxScore,
                timeValue,
                timeWeek,
                timePosition,
                minTime,
                maxTime);
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

    private static final class PlayerDungeonAggregate {
        private final Dungeon dungeon;
        private RunScore bestScore;
        private RunTime bestTime;
        private Integer minScore;
        private Integer maxScore;
        private Integer minTime;
        private Integer maxTime;

        private PlayerDungeonAggregate(Dungeon dungeon) {
            this.dungeon = dungeon;
        }
    }

    private Player resolveMain(Player player) {
        if (player == null) {
            return null;
        }
        Player current = player;
        java.util.Set<Long> visited = new java.util.HashSet<>();
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
}

