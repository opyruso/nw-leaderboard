package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.PlayerRelationshipEdgeResponse;
import com.opyruso.nwleaderboard.dto.PlayerRelationshipGraphResponse;
import com.opyruso.nwleaderboard.dto.PlayerRelationshipNodeResponse;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import com.opyruso.nwleaderboard.entity.RunTimePlayer;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScorePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunTimePlayerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.text.Collator;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.Set;

/**
 * Aggregates relationship data between players based on recorded runs.
 */
@ApplicationScoped
public class PlayerRelationshipService {

    @Inject
    PlayerRepository playerRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Inject
    RunTimePlayerRepository runTimePlayerRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<PlayerRelationshipGraphResponse> getRelationships(Long playerId) {
        if (playerId == null) {
            return Optional.empty();
        }
        Player origin = playerRepository.findById(playerId);
        if (origin == null || origin.getId() == null) {
            return Optional.empty();
        }

        Player mainCharacter = resolveMainCharacter(origin);
        List<Player> alternatePlayers = listAlternatePlayers(mainCharacter);

        Set<Long> originGroupIds = new LinkedHashSet<>();
        originGroupIds.add(origin.getId());
        if (mainCharacter != null && mainCharacter.getId() != null) {
            originGroupIds.add(mainCharacter.getId());
        }
        for (Player alternate : alternatePlayers) {
            if (alternate == null || alternate.getId() == null) {
                continue;
            }
            originGroupIds.add(alternate.getId());
        }

        Map<Long, RelationshipAggregate> aggregates = new LinkedHashMap<>();
        Set<Long> scoreRunIds = collectRunIds(originGroupIds, true);
        Set<Long> timeRunIds = collectRunIds(originGroupIds, false);
        accumulateScoreRuns(scoreRunIds, originGroupIds, aggregates);
        accumulateTimeRuns(timeRunIds, originGroupIds, aggregates);

        Map<Long, Long> runCountsBySource = new LinkedHashMap<>();
        for (RelationshipAggregate aggregate : aggregates.values()) {
            for (Entry<Long, Long> entry : aggregate.runsBySource.entrySet()) {
                Long sourceId = entry.getKey();
                Long count = entry.getValue();
                if (sourceId == null || count == null) {
                    continue;
                }
                runCountsBySource.merge(sourceId, count, Long::sum);
            }
        }

        long originRunCount = runCountsBySource.getOrDefault(origin.getId(), 0L);
        PlayerRelationshipNodeResponse originNode = new PlayerRelationshipNodeResponse(
                origin.getId(), origin.getPlayerName(), true, false, originRunCount);

        List<PlayerRelationshipNodeResponse> alternateNodes = new ArrayList<>();
        List<Player> groupedPlayers = new ArrayList<>();
        if (mainCharacter != null) {
            groupedPlayers.add(mainCharacter);
        }
        groupedPlayers.addAll(alternatePlayers);
        for (Player grouped : groupedPlayers) {
            if (grouped == null || grouped.getId() == null || grouped.getId().equals(origin.getId())) {
                continue;
            }
            long runCount = runCountsBySource.getOrDefault(grouped.getId(), 0L);
            boolean isAlternate = mainCharacter == null || !grouped.getId().equals(mainCharacter.getId());
            alternateNodes.add(new PlayerRelationshipNodeResponse(
                    grouped.getId(), grouped.getPlayerName(), false, isAlternate, runCount));
        }

        List<PlayerRelationshipNodeResponse> relatedNodes = aggregates.entrySet()
                .stream()
                .map(entry -> {
                    Long relatedId = entry.getKey();
                    RelationshipAggregate aggregate = entry.getValue();
                    if (relatedId == null || aggregate == null) {
                        return null;
                    }
                    Player participant = aggregate.player;
                    String participantName = participant != null ? participant.getPlayerName() : null;
                    return new PlayerRelationshipNodeResponse(
                            relatedId, participantName, false, false, aggregate.totalRuns);
                })
                .filter(node -> node != null && node.playerId() != null)
                .sorted((left, right) -> {
                    long leftRuns = left.runCount() != null ? left.runCount() : 0L;
                    long rightRuns = right.runCount() != null ? right.runCount() : 0L;
                    int compare = Long.compare(rightRuns, leftRuns);
                    if (compare != 0) {
                        return compare;
                    }
                    String leftName = left.playerName() != null ? left.playerName().toLowerCase(Locale.ROOT) : "";
                    String rightName = right.playerName() != null ? right.playerName().toLowerCase(Locale.ROOT) : "";
                    return leftName.compareTo(rightName);
                })
                .toList();

        List<PlayerRelationshipEdgeResponse> edges = new ArrayList<>();
        if (mainCharacter != null && mainCharacter.getId() != null) {
            Long mainId = mainCharacter.getId();
            for (Player alternate : alternatePlayers) {
                if (alternate == null || alternate.getId() == null) {
                    continue;
                }
                edges.add(new PlayerRelationshipEdgeResponse(mainId, alternate.getId(), null, true));
            }
        }

        for (Entry<Long, RelationshipAggregate> entry : aggregates.entrySet()) {
            Long targetId = entry.getKey();
            RelationshipAggregate aggregate = entry.getValue();
            if (targetId == null || aggregate == null) {
                continue;
            }
            for (Entry<Long, Long> link : aggregate.runsBySource.entrySet()) {
                Long sourceId = link.getKey();
                Long runCount = link.getValue();
                if (sourceId == null || runCount == null || runCount <= 0L) {
                    continue;
                }
                edges.add(new PlayerRelationshipEdgeResponse(sourceId, targetId, runCount, false));
            }
        }

        Map<Long, PlayerRelationshipNodeResponse> nodeMap = new LinkedHashMap<>();
        mergeNode(nodeMap, originNode);
        for (PlayerRelationshipNodeResponse node : alternateNodes) {
            mergeNode(nodeMap, node);
        }
        for (PlayerRelationshipNodeResponse node : relatedNodes) {
            mergeNode(nodeMap, node);
        }

        PlayerRelationshipGraphResponse response =
                new PlayerRelationshipGraphResponse(List.copyOf(nodeMap.values()), edges);
        return Optional.of(response);
    }

    private void mergeNode(
            Map<Long, PlayerRelationshipNodeResponse> nodes,
            PlayerRelationshipNodeResponse candidate) {
        if (nodes == null || candidate == null || candidate.playerId() == null) {
            return;
        }
        PlayerRelationshipNodeResponse existing = nodes.get(candidate.playerId());
        if (existing == null) {
            nodes.put(candidate.playerId(), candidate);
            return;
        }
        boolean origin = existing.origin() || candidate.origin();
        boolean alternate = existing.alternate() || candidate.alternate();
        Long runCount = mergeRunCount(existing.runCount(), candidate.runCount());
        String playerName = existing.playerName() != null ? existing.playerName() : candidate.playerName();
        nodes.put(
                candidate.playerId(),
                new PlayerRelationshipNodeResponse(candidate.playerId(), playerName, origin, alternate, runCount));
    }

    private Long mergeRunCount(Long left, Long right) {
        long leftValue = left != null ? Math.max(left.longValue(), 0L) : 0L;
        long rightValue = right != null ? Math.max(right.longValue(), 0L) : 0L;
        return Math.max(leftValue, rightValue);
    }

    private List<Player> listAlternatePlayers(Player origin) {
        if (origin == null || origin.getId() == null) {
            return List.of();
        }
        List<Player> rawAlternates = playerRepository.listByMainCharacterId(origin.getId());
        if (rawAlternates == null || rawAlternates.isEmpty()) {
            return List.of();
        }
        Collator collator = Collator.getInstance(Locale.ENGLISH);
        collator.setStrength(Collator.PRIMARY);
        Map<Long, Player> unique = new LinkedHashMap<>();
        for (Player alternate : rawAlternates) {
            if (alternate == null || alternate.getId() == null) {
                continue;
            }
            if (alternate.getId().equals(origin.getId())) {
                continue;
            }
            String name = alternate.getPlayerName();
            if (name == null || name.strip().isEmpty()) {
                continue;
            }
            unique.putIfAbsent(alternate.getId(), alternate);
        }
        List<Player> alternates = new ArrayList<>(unique.values());
        alternates.sort((left, right) -> {
            String leftName = left.getPlayerName() != null ? left.getPlayerName() : "";
            String rightName = right.getPlayerName() != null ? right.getPlayerName() : "";
            return collator.compare(leftName, rightName);
        });
        return List.copyOf(alternates);
    }

    private Player resolveMainCharacter(Player origin) {
        if (origin == null) {
            return null;
        }
        Player main = origin.getMainCharacter();
        if (main == null) {
            return origin;
        }
        if (main.getId() == null) {
            return origin;
        }
        if (origin.equals(main)) {
            return main;
        }
        Player persisted = playerRepository.findById(main.getId());
        return persisted != null ? persisted : main;
    }

    private Set<Long> collectRunIds(Set<Long> originGroupIds, boolean scoreRuns) {
        Set<Long> runIds = new LinkedHashSet<>();
        if (originGroupIds == null || originGroupIds.isEmpty()) {
            return runIds;
        }
        for (Long id : originGroupIds) {
            if (id == null) {
                continue;
            }
            Collection<Long> playerRuns = scoreRuns
                    ? runScorePlayerRepository.listRunIdsByPlayer(id)
                    : runTimePlayerRepository.listRunIdsByPlayer(id);
            if (playerRuns != null) {
                runIds.addAll(playerRuns);
            }
        }
        return runIds;
    }

    private void accumulateScoreRuns(
            Set<Long> runIds, Set<Long> originGroupIds, Map<Long, RelationshipAggregate> aggregates) {
        if (runIds == null || runIds.isEmpty()) {
            return;
        }
        List<RunScorePlayer> associations =
                runScorePlayerRepository.listWithPlayersByRunIds(new ArrayList<>(runIds));
        Map<Long, List<Player>> participantsByRun = new LinkedHashMap<>();
        for (RunScorePlayer association : associations) {
            if (association == null || association.getRunScore() == null) {
                continue;
            }
            Long runId = association.getRunScore().getId();
            if (runId == null) {
                continue;
            }
            Player participant = association.getPlayer();
            if (participant == null) {
                continue;
            }
            participantsByRun.computeIfAbsent(runId, key -> new ArrayList<>()).add(participant);
        }
        for (List<Player> participants : participantsByRun.values()) {
            processRunParticipants(participants, originGroupIds, aggregates);
        }
    }

    private void accumulateTimeRuns(
            Set<Long> runIds, Set<Long> originGroupIds, Map<Long, RelationshipAggregate> aggregates) {
        if (runIds == null || runIds.isEmpty()) {
            return;
        }
        List<RunTimePlayer> associations =
                runTimePlayerRepository.listWithPlayersByRunIds(new ArrayList<>(runIds));
        Map<Long, List<Player>> participantsByRun = new LinkedHashMap<>();
        for (RunTimePlayer association : associations) {
            if (association == null || association.getRunTime() == null) {
                continue;
            }
            Long runId = association.getRunTime().getId();
            if (runId == null) {
                continue;
            }
            Player participant = association.getPlayer();
            if (participant == null) {
                continue;
            }
            participantsByRun.computeIfAbsent(runId, key -> new ArrayList<>()).add(participant);
        }
        for (List<Player> participants : participantsByRun.values()) {
            processRunParticipants(participants, originGroupIds, aggregates);
        }
    }

    private void processRunParticipants(
            List<Player> participants, Set<Long> originGroupIds, Map<Long, RelationshipAggregate> aggregates) {
        if (participants == null || participants.isEmpty()) {
            return;
        }
        Map<Long, Player> playersById = new LinkedHashMap<>();
        for (Player participant : participants) {
            if (participant == null || participant.getId() == null) {
                continue;
            }
            playersById.putIfAbsent(participant.getId(), participant);
        }
        if (playersById.isEmpty()) {
            return;
        }
        List<Long> originParticipants = playersById.keySet().stream()
                .filter(id -> id != null && originGroupIds.contains(id))
                .toList();
        if (originParticipants.isEmpty()) {
            return;
        }
        for (Entry<Long, Player> entry : playersById.entrySet()) {
            Long participantId = entry.getKey();
            if (participantId == null || originGroupIds.contains(participantId)) {
                continue;
            }
            Player participant = entry.getValue();
            RelationshipAggregate aggregate =
                    aggregates.computeIfAbsent(participantId, key -> new RelationshipAggregate(participant));
            aggregate.setPlayer(participant);
            aggregate.incrementTotalRuns();
            for (Long originId : originParticipants) {
                aggregate.incrementRunsWith(originId);
            }
        }
    }

    private static final class RelationshipAggregate {
        private Player player;
        private long totalRuns = 0L;
        private final Map<Long, Long> runsBySource = new LinkedHashMap<>();

        private RelationshipAggregate(Player player) {
            this.player = player;
        }

        private void setPlayer(Player candidate) {
            if (candidate == null) {
                return;
            }
            if (this.player == null) {
                this.player = candidate;
                return;
            }
            String currentName = this.player.getPlayerName();
            if (currentName == null || currentName.strip().isEmpty()) {
                this.player = candidate;
            }
        }

        private void incrementTotalRuns() {
            totalRuns++;
        }

        private void incrementRunsWith(Long originId) {
            if (originId == null) {
                return;
            }
            runsBySource.merge(originId, 1L, Long::sum);
        }
    }
}
