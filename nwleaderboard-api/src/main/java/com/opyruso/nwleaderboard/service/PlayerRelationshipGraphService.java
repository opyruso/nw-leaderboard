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
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Builds Cytoscape-compatible graphs describing the relationships of a player.
 */
@ApplicationScoped
public class PlayerRelationshipGraphService {

    private static final String ORIGIN_COLOR = "#1e3a8a";
    private static final String ALTERNATE_COLOR = "#60a5fa";
    private static final String TEAMMATE_COLOR = "#94a3b8";
    private static final String TEAMMATE_STRONG_COLOR = "#22c55e";
    private static final String ALTERNATE_EDGE_COLOR = "#f87171";

    @Inject
    PlayerRepository playerRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Inject
    RunTimePlayerRepository runTimePlayerRepository;

    public Optional<PlayerRelationshipGraphResponse> buildGraph(Long playerId) {
        if (playerId == null) {
            return Optional.empty();
        }
        Player origin = playerRepository.findById(playerId);
        if (origin == null) {
            return Optional.empty();
        }

        Map<Long, PlayerRelationshipNodeResponse> nodeMap = new LinkedHashMap<>();
        List<PlayerRelationshipEdgeResponse> edges = new ArrayList<>();

        PlayerRelationshipNodeResponse originNode =
                new PlayerRelationshipNodeResponse(origin.getId(), safeName(origin), "origin", ORIGIN_COLOR);
        nodeMap.put(originNode.id(), originNode);

        Player main = resolveMain(origin);
        Long alternateGroupId = main != null ? main.getId() : origin.getId();

        List<Player> alternates = new ArrayList<>(playerRepository.listByMainCharacterId(alternateGroupId));
        if (main != null && !main.equals(origin)) {
            alternates.add(main);
        }

        Set<Long> alternateIds = alternates.stream()
                .filter(Objects::nonNull)
                .map(Player::getId)
                .filter(id -> id != null && !id.equals(origin.getId()))
                .collect(Collectors.toCollection(LinkedHashSet::new));

        for (Long altId : alternateIds) {
            Player alt = playerRepository.findById(altId);
            if (alt == null) {
                continue;
            }
            PlayerRelationshipNodeResponse node = new PlayerRelationshipNodeResponse(
                    alt.getId(), safeName(alt), "alternate", ALTERNATE_COLOR);
            nodeMap.putIfAbsent(node.id(), node);
        }

        Map<Long, Long> sharedRunCounts = calculateSharedRunCounts(origin);
        Map<Long, Player> relatedPlayers = loadPlayersByIds(sharedRunCounts.keySet());

        for (Long alternateId : alternateIds) {
            long sharedRuns = sharedRunCounts.getOrDefault(alternateId, 0L);
            PlayerRelationshipEdgeResponse edge = new PlayerRelationshipEdgeResponse(
                    buildEdgeId(origin.getId(), alternateId),
                    origin.getId(),
                    alternateId,
                    "alternate",
                    ALTERNATE_EDGE_COLOR,
                    "dotted",
                    2.5,
                    sharedRuns);
            edges.add(edge);
            sharedRunCounts.remove(alternateId);
        }

        for (Map.Entry<Long, Long> entry : sharedRunCounts.entrySet()) {
            Long teammateId = entry.getKey();
            if (teammateId == null || teammateId.equals(origin.getId())) {
                continue;
            }
            long sharedRuns = entry.getValue() != null ? entry.getValue() : 0L;
            Player teammate = relatedPlayers.get(teammateId);
            if (teammate == null) {
                teammate = playerRepository.findById(teammateId);
            }
            if (teammate == null) {
                continue;
            }
            nodeMap.putIfAbsent(
                    teammate.getId(),
                    new PlayerRelationshipNodeResponse(teammate.getId(), safeName(teammate), "teammate", TEAMMATE_COLOR));
            EdgeStyle style = classifyRelationship(sharedRuns);
            PlayerRelationshipEdgeResponse edge = new PlayerRelationshipEdgeResponse(
                    buildEdgeId(origin.getId(), teammateId),
                    origin.getId(),
                    teammateId,
                    style.category(),
                    style.color(),
                    "solid",
                    style.width(),
                    sharedRuns);
            edges.add(edge);
        }

        PlayerRelationshipGraphResponse graph =
                new PlayerRelationshipGraphResponse(new ArrayList<>(nodeMap.values()), edges);
        return Optional.of(graph);
    }

    private Map<Long, Long> calculateSharedRunCounts(Player origin) {
        if (origin == null || origin.getId() == null) {
            return Map.of();
        }
        Map<Long, Long> counts = new LinkedHashMap<>();
        accumulateSharedRuns(counts, origin.getId(), runScorePlayerRepository.listByPlayerId(origin.getId()));
        accumulateSharedRuns(counts, origin.getId(), runTimePlayerRepository.listByPlayerId(origin.getId()));
        return counts;
    }

    private void accumulateSharedRuns(Map<Long, Long> counts, Long originId, List<?> associations) {
        if (originId == null || associations == null || associations.isEmpty()) {
            return;
        }
        Set<Long> runIds = associations.stream()
                .map(association -> {
                    if (association instanceof RunScorePlayer score) {
                        return score.getRunScore() != null ? score.getRunScore().getId() : null;
                    }
                    if (association instanceof RunTimePlayer time) {
                        return time.getRunTime() != null ? time.getRunTime().getId() : null;
                    }
                    return null;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (runIds.isEmpty()) {
            return;
        }
        if (associations.get(0) instanceof RunScorePlayer) {
            List<RunScorePlayer> participants =
                    runScorePlayerRepository.listWithPlayersByRunIds(new ArrayList<>(runIds));
            addParticipants(counts, originId, participants);
        } else if (associations.get(0) instanceof RunTimePlayer) {
            List<RunTimePlayer> participants =
                    runTimePlayerRepository.listWithPlayersByRunIds(new ArrayList<>(runIds));
            addParticipants(counts, originId, participants);
        }
    }

    private void addParticipants(Map<Long, Long> counts, Long originId, List<?> participants) {
        if (participants == null || participants.isEmpty()) {
            return;
        }
        Map<Long, Set<Long>> runsToPlayers = new LinkedHashMap<>();
        for (Object item : participants) {
            Long runId = null;
            Player participant = null;
            if (item instanceof RunScorePlayer score) {
                runId = score.getRunScore() != null ? score.getRunScore().getId() : null;
                participant = score.getPlayer();
            } else if (item instanceof RunTimePlayer time) {
                runId = time.getRunTime() != null ? time.getRunTime().getId() : null;
                participant = time.getPlayer();
            }
            if (runId == null || participant == null || participant.getId() == null) {
                continue;
            }
            runsToPlayers
                    .computeIfAbsent(runId, id -> new LinkedHashSet<>())
                    .add(participant.getId());
        }
        for (Set<Long> playerIds : runsToPlayers.values()) {
            if (playerIds == null || playerIds.isEmpty() || !playerIds.contains(originId)) {
                continue;
            }
            for (Long participantId : playerIds) {
                if (participantId == null || participantId.equals(originId)) {
                    continue;
                }
                counts.merge(participantId, 1L, Long::sum);
            }
        }
    }

    private Map<Long, Player> loadPlayersByIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        return playerRepository.listByIds(ids).stream()
                .filter(player -> player != null && player.getId() != null)
                .collect(Collectors.toMap(Player::getId, player -> player, (left, right) -> left, LinkedHashMap::new));
    }

    private EdgeStyle classifyRelationship(long sharedRuns) {
        if (sharedRuns >= 10L) {
            return new EdgeStyle("teammate-strong", TEAMMATE_STRONG_COLOR, 3.0);
        }
        if (sharedRuns >= 5L) {
            return new EdgeStyle("teammate-regular", TEAMMATE_COLOR, 2.0);
        }
        return new EdgeStyle("teammate-light", TEAMMATE_COLOR, 1.5);
    }

    private String buildEdgeId(Long originId, Long targetId) {
        return originId + "-" + targetId;
    }

    private String safeName(Player player) {
        if (player == null || player.getPlayerName() == null) {
            return "";
        }
        return player.getPlayerName();
    }

    private Player resolveMain(Player player) {
        if (player == null) {
            return null;
        }
        Player current = player;
        Set<Long> visited = new LinkedHashSet<>();
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

    private record EdgeStyle(String category, String color, double width) {}
}
