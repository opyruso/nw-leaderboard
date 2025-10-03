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
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/** Builds relationship graphs for players based on shared runs. */
@ApplicationScoped
public class PlayerRelationshipService {

    private static final String COLOR_ORIGIN = "#1d4ed8";
    private static final String COLOR_ALTERNATE = "#60a5fa";
    private static final String COLOR_OTHER = "#94a3b8";
    private static final String COLOR_ALT_EDGE = "#f87171";
    private static final String COLOR_STRONG_EDGE = "#22c55e";
    private static final String COLOR_NEUTRAL_EDGE = "#94a3b8";

    @Inject PlayerRepository playerRepository;

    @Inject RunScorePlayerRepository runScorePlayerRepository;

    @Inject RunTimePlayerRepository runTimePlayerRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<PlayerRelationshipGraphResponse> buildGraph(Long playerId) {
        if (playerId == null) {
            return Optional.empty();
        }
        Player origin = playerRepository.findById(playerId);
        if (origin == null || origin.getId() == null) {
            return Optional.empty();
        }

        Map<Long, Player> playersById = new LinkedHashMap<>();
        playersById.put(origin.getId(), origin);

        LinkedHashSet<Long> trackedPlayerIds = new LinkedHashSet<>();
        trackedPlayerIds.add(origin.getId());

        LinkedHashSet<Long> alternateIds = new LinkedHashSet<>();

        Player main = resolveMain(origin);
        if (main != null && main.getId() != null && !main.equals(origin)) {
            playersById.putIfAbsent(main.getId(), main);
            alternateIds.add(main.getId());
            List<Player> siblings = playerRepository.listByMainCharacterId(main.getId());
            addAlternatePlayers(alternateIds, playersById, siblings);
        } else {
            List<Player> alternates = playerRepository.listByMainCharacterId(origin.getId());
            addAlternatePlayers(alternateIds, playersById, alternates);
        }
        alternateIds.remove(origin.getId());
        trackedPlayerIds.addAll(alternateIds);

        LinkedHashSet<Long> scoreRunIds = new LinkedHashSet<>();
        LinkedHashSet<Long> timeRunIds = new LinkedHashSet<>();
        for (Long id : trackedPlayerIds) {
            if (id == null) {
                continue;
            }
            scoreRunIds.addAll(runScorePlayerRepository.listRunIdsByPlayer(id));
            timeRunIds.addAll(runTimePlayerRepository.listRunIdsByPlayer(id));
        }

        Map<PlayerPair, Long> pairCounts = new LinkedHashMap<>();

        List<RunScorePlayer> scoreAssociations =
                runScorePlayerRepository.listWithPlayersByRunIds(new ArrayList<>(scoreRunIds));
        collectPairsFromScoreAssociations(scoreAssociations, pairCounts, playersById);

        List<RunTimePlayer> timeAssociations =
                runTimePlayerRepository.listWithPlayersByRunIds(new ArrayList<>(timeRunIds));
        collectPairsFromTimeAssociations(timeAssociations, pairCounts, playersById);

        List<PlayerRelationshipEdgeResponse> edges = new ArrayList<>();
        Long originId = origin.getId();
        for (Long alternateId : alternateIds) {
            if (alternateId == null) {
                continue;
            }
            PlayerPair pair = PlayerPair.of(originId, alternateId);
            long count = pairCounts.getOrDefault(pair, 0L);
            edges.add(new PlayerRelationshipEdgeResponse(
                    "edge-" + originId + '-' + alternateId,
                    originId,
                    alternateId,
                    "alternate",
                    count,
                    COLOR_ALT_EDGE,
                    "dashed",
                    2.6d));
            pairCounts.remove(pair);
        }

        for (Map.Entry<PlayerPair, Long> entry : pairCounts.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            PlayerPair pair = entry.getKey();
            if (!pair.touchesAny(trackedPlayerIds)) {
                continue;
            }
            Long leftId = pair.left();
            Long rightId = pair.right();
            Player leftPlayer = playersById.get(leftId);
            Player rightPlayer = playersById.get(rightId);
            if (leftPlayer == null || rightPlayer == null) {
                continue;
            }
            long count = entry.getValue() != null ? entry.getValue() : 0L;
            String category =
                    trackedPlayerIds.contains(leftId) && trackedPlayerIds.contains(rightId)
                            ? "internal"
                            : "teammate";
            String color = count >= 10L ? COLOR_STRONG_EDGE : COLOR_NEUTRAL_EDGE;
            double width = count >= 10L ? 4.0d : count >= 5L ? 3.0d : 2.2d;
            edges.add(new PlayerRelationshipEdgeResponse(
                    "edge-" + leftId + '-' + rightId,
                    leftId,
                    rightId,
                    category,
                    count,
                    color,
                    "solid",
                    width));
        }

        LinkedHashSet<Long> nodeIds = new LinkedHashSet<>();
        nodeIds.add(originId);
        nodeIds.addAll(alternateIds);
        for (PlayerRelationshipEdgeResponse edge : edges) {
            if (edge == null) {
                continue;
            }
            if (edge.sourceId() != null) {
                nodeIds.add(edge.sourceId());
            }
            if (edge.targetId() != null) {
                nodeIds.add(edge.targetId());
            }
        }

        List<PlayerRelationshipNodeResponse> nodes = new ArrayList<>();
        nodes.add(new PlayerRelationshipNodeResponse(originId, safePlayerName(origin), "origin", COLOR_ORIGIN));

        nodes.addAll(
                alternateIds.stream()
                        .map(playersById::get)
                        .filter(Objects::nonNull)
                        .sorted(Comparator.comparing(this::safePlayerName))
                        .map(alternate ->
                                new PlayerRelationshipNodeResponse(
                                        alternate.getId(), safePlayerName(alternate), "alternate", COLOR_ALTERNATE))
                        .toList());

        LinkedHashSet<Long> otherIds = new LinkedHashSet<>(nodeIds);
        otherIds.remove(originId);
        otherIds.removeAll(alternateIds);
        nodes.addAll(
                otherIds.stream()
                        .map(playersById::get)
                        .filter(Objects::nonNull)
                        .sorted(Comparator.comparing(this::safePlayerName))
                        .map(player ->
                                new PlayerRelationshipNodeResponse(
                                        player.getId(), safePlayerName(player), "teammate", COLOR_OTHER))
                        .toList());

        return Optional.of(new PlayerRelationshipGraphResponse(originId, nodes, edges));
    }

    private void addAlternatePlayers(
            Set<Long> alternateIds, Map<Long, Player> playersById, Collection<Player> players) {
        if (players == null) {
            return;
        }
        for (Player player : players) {
            if (player == null || player.getId() == null) {
                continue;
            }
            alternateIds.add(player.getId());
            playersById.putIfAbsent(player.getId(), player);
        }
    }

    private void collectPairsFromScoreAssociations(
            List<RunScorePlayer> associations,
            Map<PlayerPair, Long> pairCounts,
            Map<Long, Player> playersById) {
        if (associations == null || associations.isEmpty()) {
            return;
        }
        Long currentRunId = null;
        LinkedHashSet<Long> participants = new LinkedHashSet<>();
        for (RunScorePlayer association : associations) {
            if (association == null) {
                continue;
            }
            Long runId = association.getRunScore() != null ? association.getRunScore().getId() : null;
            if (runId == null) {
                continue;
            }
            if (!runId.equals(currentRunId)) {
                accumulatePairs(pairCounts, participants);
                participants.clear();
                currentRunId = runId;
            }
            Player participant = association.getPlayer();
            if (participant == null || participant.getId() == null) {
                continue;
            }
            playersById.putIfAbsent(participant.getId(), participant);
            participants.add(participant.getId());
        }
        accumulatePairs(pairCounts, participants);
    }

    private void collectPairsFromTimeAssociations(
            List<RunTimePlayer> associations,
            Map<PlayerPair, Long> pairCounts,
            Map<Long, Player> playersById) {
        if (associations == null || associations.isEmpty()) {
            return;
        }
        Long currentRunId = null;
        LinkedHashSet<Long> participants = new LinkedHashSet<>();
        for (RunTimePlayer association : associations) {
            if (association == null) {
                continue;
            }
            Long runId = association.getRunTime() != null ? association.getRunTime().getId() : null;
            if (runId == null) {
                continue;
            }
            if (!runId.equals(currentRunId)) {
                accumulatePairs(pairCounts, participants);
                participants.clear();
                currentRunId = runId;
            }
            Player participant = association.getPlayer();
            if (participant == null || participant.getId() == null) {
                continue;
            }
            playersById.putIfAbsent(participant.getId(), participant);
            participants.add(participant.getId());
        }
        accumulatePairs(pairCounts, participants);
    }

    private void accumulatePairs(Map<PlayerPair, Long> pairCounts, Collection<Long> participantIds) {
        if (participantIds == null || participantIds.size() < 2) {
            return;
        }
        List<Long> ids = participantIds.stream().filter(Objects::nonNull).distinct().toList();
        for (int i = 0; i < ids.size(); i++) {
            Long left = ids.get(i);
            if (left == null) {
                continue;
            }
            for (int j = i + 1; j < ids.size(); j++) {
                Long right = ids.get(j);
                if (right == null) {
                    continue;
                }
                PlayerPair pair = PlayerPair.of(left, right);
                pairCounts.merge(pair, 1L, Long::sum);
            }
        }
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

    private String safePlayerName(Player player) {
        if (player == null) {
            return "";
        }
        String name = player.getPlayerName();
        if (name == null) {
            return player.getId() != null ? "#" + player.getId() : "";
        }
        String trimmed = name.strip();
        if (trimmed.isEmpty()) {
            return player.getId() != null ? "#" + player.getId() : "";
        }
        return trimmed;
    }

    private record PlayerPair(Long left, Long right) {
        static PlayerPair of(Long a, Long b) {
            if (a == null || b == null) {
                return new PlayerPair(a, b);
            }
            if (a.compareTo(b) <= 0) {
                return new PlayerPair(a, b);
            }
            return new PlayerPair(b, a);
        }

        boolean touchesAny(Set<Long> ids) {
            if (ids == null || ids.isEmpty()) {
                return false;
            }
            return (left != null && ids.contains(left)) || (right != null && ids.contains(right));
        }
    }
}
