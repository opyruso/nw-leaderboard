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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Builds graph data describing the relationships between a player and their teammates.
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
        if (origin == null) {
            return Optional.empty();
        }

        Player accountRoot = resolveAccountRoot(origin);
        Map<Long, Player> accountPlayers = loadAccountPlayers(origin, accountRoot);
        Map<Long, PlayerNodeBuilder> nodes = new LinkedHashMap<>();
        addNode(nodes, origin, "origin");
        for (Player accountPlayer : accountPlayers.values()) {
            if (accountPlayer == null || accountPlayer.getId() == null) {
                continue;
            }
            if (Objects.equals(accountPlayer.getId(), origin.getId())) {
                continue;
            }
            addNode(nodes, accountPlayer, "alternate");
        }

        Set<Long> runPlayerIds = new LinkedHashSet<>();
        runPlayerIds.add(origin.getId());
        runPlayerIds.addAll(accountPlayers.keySet());

        Map<Long, Set<Long>> runParticipants = new HashMap<>();
        Map<Long, String> playerNames = new HashMap<>();
        collectScoreRuns(runPlayerIds, runParticipants, playerNames);
        collectTimeRuns(runPlayerIds, runParticipants, playerNames);

        for (Map.Entry<Long, String> entry : playerNames.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            Long playerKey = entry.getKey();
            if (!nodes.containsKey(playerKey)) {
                nodes.put(playerKey, new PlayerNodeBuilder(playerKey, entry.getValue(), "other"));
            }
        }

        Map<PlayerPair, Integer> sharedRuns = computeSharedRuns(runParticipants);

        Map<Long, Set<Long>> externalAccountLinks = mapExternalAccountLinks(
                accountRoot, accountPlayers.keySet(), playerNames.keySet(), nodes, playerNames);

        List<PlayerRelationshipEdgeResponse> edges = buildEdges(origin, accountPlayers.keySet(), sharedRuns);
        edges.addAll(buildAccountEdges(origin, accountPlayers.keySet(), sharedRuns));
        edges.addAll(buildExternalAccountEdges(externalAccountLinks, sharedRuns));

        List<PlayerRelationshipNodeResponse> nodeResponses = buildNodeResponses(nodes, playerNames);
        edges = mergeAndSortEdges(edges);

        return Optional.of(new PlayerRelationshipGraphResponse(nodeResponses, edges));
    }

    private Map<PlayerPair, Integer> computeSharedRuns(Map<Long, Set<Long>> runParticipants) {
        Map<PlayerPair, Integer> sharedRuns = new HashMap<>();
        for (Set<Long> participants : runParticipants.values()) {
            if (participants == null || participants.size() < 2) {
                continue;
            }
            List<Long> ordered = participants.stream()
                    .filter(Objects::nonNull)
                    .distinct()
                    .sorted()
                    .toList();
            int size = ordered.size();
            for (int i = 0; i < size - 1; i++) {
                Long left = ordered.get(i);
                if (left == null) {
                    continue;
                }
                for (int j = i + 1; j < size; j++) {
                    Long right = ordered.get(j);
                    if (right == null) {
                        continue;
                    }
                    PlayerPair pair = PlayerPair.of(left, right);
                    if (pair != null) {
                        sharedRuns.merge(pair, 1, Integer::sum);
                    }
                }
            }
        }
        return sharedRuns;
    }

    private List<PlayerRelationshipEdgeResponse> buildEdges(
            Player origin, Set<Long> accountNodeIds, Map<PlayerPair, Integer> sharedRuns) {
        if (sharedRuns.isEmpty()) {
            return new ArrayList<>();
        }
        List<PlayerRelationshipEdgeResponse> edges = new ArrayList<>();
        for (Map.Entry<PlayerPair, Integer> entry : sharedRuns.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            PlayerPair pair = entry.getKey();
            Integer count = entry.getValue();
            if (count == null || count <= 0) {
                continue;
            }
            if (isAccountLink(origin, accountNodeIds, pair)) {
                continue;
            }
            String category = classifySharedRuns(count);
            edges.add(
                    new PlayerRelationshipEdgeResponse(
                            pair.edgeId(),
                            pair.left().toString(),
                            pair.right().toString(),
                            category,
                            count));
        }
        return edges;
    }

    private List<PlayerRelationshipEdgeResponse> buildAccountEdges(
            Player origin, Collection<Long> accountPlayerIds, Map<PlayerPair, Integer> sharedRuns) {
        if (accountPlayerIds == null || accountPlayerIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<PlayerRelationshipEdgeResponse> edges = new ArrayList<>();
        for (Long accountPlayerId : accountPlayerIds) {
            if (accountPlayerId == null || Objects.equals(accountPlayerId, origin.getId())) {
                continue;
            }
            PlayerPair pair = PlayerPair.of(origin.getId(), accountPlayerId);
            Integer count = sharedRuns.getOrDefault(pair, 0);
            edges.add(
                    new PlayerRelationshipEdgeResponse(
                            pair.edgeId(),
                            pair.left().toString(),
                            pair.right().toString(),
                            "alternate",
                            count));
        }
        return edges;
    }

    private Map<Long, Set<Long>> mapExternalAccountLinks(
            Player accountRoot,
            Set<Long> accountPlayerIds,
            Set<Long> graphPlayerIds,
            Map<Long, PlayerNodeBuilder> nodes,
            Map<Long, String> playerNames) {
        Map<Long, Set<Long>> accountLinks = new LinkedHashMap<>();
        if (nodes == null || playerNames == null) {
            return accountLinks;
        }
        if (graphPlayerIds == null || graphPlayerIds.isEmpty()) {
            return accountLinks;
        }

        Long rootId = accountRoot != null ? accountRoot.getId() : null;

        List<Player> relatedPlayers = playerRepository.listByIds(graphPlayerIds);
        for (Player participant : relatedPlayers) {
            if (participant == null || participant.getId() == null) {
                continue;
            }
            Player accountMain = resolveAccountRoot(participant);
            if (accountMain == null || accountMain.getId() == null) {
                continue;
            }
            Long accountMainId = accountMain.getId();
            if (accountMainId.equals(participant.getId())) {
                continue;
            }
            if (rootId != null && rootId.equals(accountMainId)) {
                continue;
            }
            if (accountPlayerIds != null && accountPlayerIds.contains(accountMainId)) {
                continue;
            }

            addNode(nodes, accountMain, "other");
            playerNames.putIfAbsent(accountMainId, safeName(accountMain.getPlayerName()));

            accountLinks
                    .computeIfAbsent(accountMainId, ignored -> new LinkedHashSet<>())
                    .add(participant.getId());
        }

        return accountLinks;
    }

    private List<PlayerRelationshipEdgeResponse> buildExternalAccountEdges(
            Map<Long, Set<Long>> externalAccountLinks, Map<PlayerPair, Integer> sharedRuns) {
        if (externalAccountLinks == null || externalAccountLinks.isEmpty()) {
            return List.of();
        }

        List<PlayerRelationshipEdgeResponse> edges = new ArrayList<>();
        for (Map.Entry<Long, Set<Long>> entry : externalAccountLinks.entrySet()) {
            if (entry == null || entry.getKey() == null) {
                continue;
            }
            Long mainId = entry.getKey();
            Set<Long> alternates = entry.getValue();
            if (alternates == null || alternates.isEmpty()) {
                continue;
            }
            for (Long alternateId : alternates) {
                PlayerPair pair = PlayerPair.of(mainId, alternateId);
                if (pair == null) {
                    continue;
                }
                Integer count = sharedRuns.getOrDefault(pair, 0);
                edges.add(
                        new PlayerRelationshipEdgeResponse(
                                pair.edgeId(),
                                pair.left().toString(),
                                pair.right().toString(),
                                "alternate",
                                count));
            }
        }

        return edges;
    }

    private boolean isAccountLink(Player origin, Set<Long> accountNodeIds, PlayerPair pair) {
        if (origin == null || origin.getId() == null) {
            return false;
        }
        if (accountNodeIds == null || accountNodeIds.isEmpty()) {
            return false;
        }
        Long originId = origin.getId();
        if (!pair.contains(originId)) {
            return false;
        }
        Long other = pair.other(originId);
        return other != null && accountNodeIds.contains(other);
    }

    private String classifySharedRuns(int count) {
        if (count >= 10) {
            return "strong";
        }
        if (count >= 5) {
            return "medium";
        }
        return "weak";
    }

    private List<PlayerRelationshipNodeResponse> buildNodeResponses(
            Map<Long, PlayerNodeBuilder> nodes, Map<Long, String> playerNames) {
        List<PlayerRelationshipNodeResponse> responses = new ArrayList<>(nodes.size());
        List<PlayerNodeBuilder> builders = new ArrayList<>(nodes.values());
        builders.sort(Comparator
                .comparing(PlayerNodeBuilder::priority)
                .thenComparing(builder -> builder.name.toLowerCase(Locale.ROOT)));
        for (PlayerNodeBuilder builder : builders) {
            if (builder == null || builder.id == null) {
                continue;
            }
            String name = builder.name;
            if ((name == null || name.isBlank()) && playerNames.containsKey(builder.id)) {
                name = playerNames.get(builder.id);
            }
            responses.add(new PlayerRelationshipNodeResponse(builder.id.toString(), name, builder.category));
        }
        return responses;
    }

    private List<PlayerRelationshipEdgeResponse> mergeAndSortEdges(List<PlayerRelationshipEdgeResponse> edges) {
        if (edges == null || edges.isEmpty()) {
            return List.of();
        }
        Map<String, PlayerRelationshipEdgeResponse> merged = new LinkedHashMap<>();
        for (PlayerRelationshipEdgeResponse edge : edges) {
            if (edge == null || edge.id() == null) {
                continue;
            }
            merged.put(edge.id(), edge);
        }
        return merged.values().stream()
                .sorted(Comparator
                        .comparing(PlayerRelationshipEdgeResponse::category)
                        .thenComparing(PlayerRelationshipEdgeResponse::id))
                .collect(Collectors.toList());
    }

    private void collectScoreRuns(
            Collection<Long> playerIds, Map<Long, Set<Long>> runParticipants, Map<Long, String> playerNames) {
        if (playerIds == null || playerIds.isEmpty()) {
            return;
        }
        Set<Long> runIds = new LinkedHashSet<>();
        for (Long playerId : playerIds) {
            if (playerId == null) {
                continue;
            }
            runIds.addAll(runScorePlayerRepository.listRunIdsByPlayer(playerId));
        }
        if (runIds.isEmpty()) {
            return;
        }
        List<RunScorePlayer> associations =
                runScorePlayerRepository.listWithPlayersByRunIds(new ArrayList<>(runIds));
        for (RunScorePlayer association : associations) {
            if (association == null || association.getRunScore() == null || association.getPlayer() == null) {
                continue;
            }
            Long runId = association.getRunScore().getId();
            Long participantId = association.getPlayer().getId();
            if (runId == null || participantId == null) {
                continue;
            }
            runParticipants.computeIfAbsent(runId, ignored -> new LinkedHashSet<>()).add(participantId);
            playerNames.putIfAbsent(participantId, safeName(association.getPlayer().getPlayerName()));
        }
    }

    private void collectTimeRuns(
            Collection<Long> playerIds, Map<Long, Set<Long>> runParticipants, Map<Long, String> playerNames) {
        if (playerIds == null || playerIds.isEmpty()) {
            return;
        }
        Set<Long> runIds = new LinkedHashSet<>();
        for (Long playerId : playerIds) {
            if (playerId == null) {
                continue;
            }
            runIds.addAll(runTimePlayerRepository.listRunIdsByPlayer(playerId));
        }
        if (runIds.isEmpty()) {
            return;
        }
        List<RunTimePlayer> associations =
                runTimePlayerRepository.listWithPlayersByRunIds(new ArrayList<>(runIds));
        for (RunTimePlayer association : associations) {
            if (association == null || association.getRunTime() == null || association.getPlayer() == null) {
                continue;
            }
            Long runId = association.getRunTime().getId();
            Long participantId = association.getPlayer().getId();
            if (runId == null || participantId == null) {
                continue;
            }
            runParticipants.computeIfAbsent(runId, ignored -> new LinkedHashSet<>()).add(participantId);
            playerNames.putIfAbsent(participantId, safeName(association.getPlayer().getPlayerName()));
        }
    }

    private Map<Long, Player> loadAccountPlayers(Player origin, Player accountRoot) {
        Map<Long, Player> players = new LinkedHashMap<>();
        if (origin != null && origin.getId() != null) {
            players.put(origin.getId(), origin);
        }
        if (accountRoot == null || accountRoot.getId() == null) {
            return players;
        }
        players.put(accountRoot.getId(), accountRoot);
        List<Player> alternates = playerRepository.listByMainCharacterId(accountRoot.getId());
        for (Player alternate : alternates) {
            if (alternate == null || alternate.getId() == null) {
                continue;
            }
            players.put(alternate.getId(), alternate);
        }
        return players;
    }

    private Player resolveAccountRoot(Player player) {
        if (player == null) {
            return null;
        }
        Player current = player;
        Set<Long> visited = new LinkedHashSet<>();
        while (current.getMainCharacter() != null) {
            Long id = current.getId();
            if (id != null && !visited.add(id)) {
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

    private void addNode(Map<Long, PlayerNodeBuilder> nodes, Player player, String category) {
        if (player == null || player.getId() == null) {
            return;
        }
        nodes.putIfAbsent(
                player.getId(), new PlayerNodeBuilder(player.getId(), safeName(player.getPlayerName()), category));
    }

    private String safeName(String name) {
        if (name == null) {
            return "";
        }
        String trimmed = name.strip();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private record PlayerPair(Long left, Long right) {

        static PlayerPair of(Long first, Long second) {
            if (first == null || second == null) {
                return null;
            }
            long a = first;
            long b = second;
            if (a == b) {
                return new PlayerPair(a, b);
            }
            return a < b ? new PlayerPair(a, b) : new PlayerPair(b, a);
        }

        boolean contains(Long playerId) {
            if (playerId == null) {
                return false;
            }
            return Objects.equals(left, playerId) || Objects.equals(right, playerId);
        }

        Long other(Long playerId) {
            if (playerId == null) {
                return null;
            }
            if (Objects.equals(left, playerId)) {
                return right;
            }
            if (Objects.equals(right, playerId)) {
                return left;
            }
            return null;
        }

        String edgeId() {
            return left + "-" + right;
        }
    }

    private static final class PlayerNodeBuilder {
        private final Long id;
        private final String name;
        private final String category;

        private PlayerNodeBuilder(Long id, String name, String category) {
            this.id = id;
            this.name = name != null ? name : "";
            this.category = category != null ? category : "other";
        }

        private int priority() {
            return switch (category) {
                case "origin" -> 0;
                case "alternate" -> 1;
                default -> 2;
            };
        }
    }
}
