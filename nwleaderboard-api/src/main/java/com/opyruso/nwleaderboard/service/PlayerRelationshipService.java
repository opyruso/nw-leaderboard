package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.PlayerRelationshipGraphResponse;
import com.opyruso.nwleaderboard.dto.PlayerRelationshipGraphResponse.CytoscapeElement;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScorePlayerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
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
 * Builds Cytoscape graph payloads describing the network around a player.
 */
@ApplicationScoped
public class PlayerRelationshipService {

    private static final String COLOR_ORIGIN = "#1e3a8a";
    private static final String COLOR_ALTERNATE = "#60a5fa";
    private static final String COLOR_TEAMMATE = "#94a3b8";
    private static final String COLOR_STRONG_LINK = "#16a34a";
    private static final String COLOR_MEDIUM_LINK = "#475569";
    private static final String COLOR_LIGHT_LINK = "#94a3b8";
    private static final String COLOR_ALT_LINK = "#ef4444";

    @Inject
    PlayerRepository playerRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Transactional(Transactional.TxType.SUPPORTS)
    public Optional<PlayerRelationshipGraphResponse> buildGraph(Long playerId) {
        if (playerId == null) {
            return Optional.empty();
        }
        Player origin = playerRepository.findById(playerId);
        if (origin == null) {
            return Optional.empty();
        }

        Map<Long, Player> playersById = new LinkedHashMap<>();
        playersById.put(origin.getId(), origin);

        Set<Long> alternateIds = resolveAlternatePlayerIds(origin, playersById);

        Map<Long, List<Long>> runParticipants = collectRunParticipants(playerId, playersById);

        Map<Pair, Integer> runCounts = countSharedRuns(runParticipants.values());

        List<CytoscapeElement> nodes = buildNodePayload(playersById.values(), origin.getId(), alternateIds);
        List<CytoscapeElement> edges = buildEdgePayload(runCounts, origin.getId(), alternateIds);

        addAlternateEdges(edges, origin.getId(), alternateIds);

        return Optional.of(new PlayerRelationshipGraphResponse(nodes, edges));
    }

    private Set<Long> resolveAlternatePlayerIds(Player origin, Map<Long, Player> playersById) {
        if (origin == null) {
            return Set.of();
        }
        LinkedHashSet<Long> alternates = new LinkedHashSet<>();
        Player main = resolveMain(origin);
        if (main != null && main.getId() != null && !main.getId().equals(origin.getId())) {
            playersById.putIfAbsent(main.getId(), main);
            alternates.add(main.getId());
            for (Player related : playerRepository.listByMainCharacterId(main.getId())) {
                if (related == null || related.getId() == null || related.getId().equals(origin.getId())) {
                    continue;
                }
                alternates.add(related.getId());
                playersById.putIfAbsent(related.getId(), related);
            }
            return alternates;
        }
        for (Player alt : playerRepository.listByMainCharacterId(origin.getId())) {
            if (alt == null || alt.getId() == null || alt.getId().equals(origin.getId())) {
                continue;
            }
            alternates.add(alt.getId());
            playersById.putIfAbsent(alt.getId(), alt);
        }
        return alternates;
    }

    private Map<Long, List<Long>> collectRunParticipants(Long playerId, Map<Long, Player> playersById) {
        List<RunScorePlayer> associations = runScorePlayerRepository.listByPlayerId(playerId);
        if (associations == null || associations.isEmpty()) {
            return Collections.emptyMap();
        }
        List<Long> runIds = associations.stream()
                .map(association -> association != null ? association.getRunScore() : null)
                .filter(Objects::nonNull)
                .map(run -> run.getId())
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        if (runIds.isEmpty()) {
            return Collections.emptyMap();
        }
        List<RunScorePlayer> participants = runScorePlayerRepository.listWithPlayersByRunIds(runIds);
        Map<Long, List<Long>> runParticipants = new LinkedHashMap<>();
        for (RunScorePlayer participant : participants) {
            if (participant == null || participant.getRunScore() == null) {
                continue;
            }
            Long runId = participant.getRunScore().getId();
            Player player = participant.getPlayer();
            if (runId == null || player == null || player.getId() == null) {
                continue;
            }
            playersById.putIfAbsent(player.getId(), player);
            runParticipants.computeIfAbsent(runId, id -> new ArrayList<>()).add(player.getId());
        }
        return runParticipants;
    }

    private Map<Pair, Integer> countSharedRuns(Collection<List<Long>> runs) {
        if (runs == null || runs.isEmpty()) {
            return Map.of();
        }
        Map<Pair, Integer> counts = new LinkedHashMap<>();
        for (List<Long> run : runs) {
            if (run == null || run.isEmpty()) {
                continue;
            }
            List<Long> distinct = run.stream().filter(Objects::nonNull).distinct().collect(Collectors.toList());
            int size = distinct.size();
            for (int i = 0; i < size; i++) {
                Long left = distinct.get(i);
                if (left == null) {
                    continue;
                }
                for (int j = i + 1; j < size; j++) {
                    Long right = distinct.get(j);
                    if (right == null) {
                        continue;
                    }
                    Pair pair = Pair.of(left, right);
                    counts.merge(pair, 1, Integer::sum);
                }
            }
        }
        return counts;
    }

    private List<CytoscapeElement> buildNodePayload(
            Collection<Player> players, Long originId, Set<Long> alternateIds) {
        if (players == null || players.isEmpty()) {
            return List.of();
        }
        List<Player> ordered = new ArrayList<>(players);
        ordered.sort(
                Comparator.comparing((Player player) -> !Objects.equals(player != null ? player.getId() : null, originId))
                        .thenComparing(
                                player -> player != null && player.getPlayerName() != null
                                        ? player.getPlayerName().toLowerCase(Locale.ROOT)
                                        : ""));
        List<CytoscapeElement> nodes = new ArrayList<>(ordered.size());
        for (Player player : ordered) {
            if (player == null || player.getId() == null) {
                continue;
            }
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("id", String.valueOf(player.getId()));
            data.put("label", safeName(player.getPlayerName()));
            if (Objects.equals(player.getId(), originId)) {
                data.put("color", COLOR_ORIGIN);
                data.put("type", "origin");
            } else if (alternateIds.contains(player.getId())) {
                data.put("color", COLOR_ALTERNATE);
                data.put("type", "alternate");
            } else {
                data.put("color", COLOR_TEAMMATE);
                data.put("type", "teammate");
            }
            nodes.add(new CytoscapeElement(data));
        }
        return nodes;
    }

    private List<CytoscapeElement> buildEdgePayload(
            Map<Pair, Integer> counts, Long originId, Set<Long> alternateIds) {
        if (counts == null || counts.isEmpty()) {
            return new ArrayList<>();
        }
        List<CytoscapeElement> edges = new ArrayList<>(counts.size());
        for (Map.Entry<Pair, Integer> entry : counts.entrySet()) {
            Pair pair = entry.getKey();
            if (pair == null) {
                continue;
            }
            if (pair.contains(originId) && alternateIds.contains(pair.other(originId))) {
                // Alternate edges are handled separately to keep their styling consistent.
                continue;
            }
            Integer sharedRuns = entry.getValue();
            if (sharedRuns == null || sharedRuns <= 0) {
                continue;
            }
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("id", pair.id());
            data.put("source", String.valueOf(pair.left()));
            data.put("target", String.valueOf(pair.right()));
            data.put("count", sharedRuns);
            data.put("lineStyle", "solid");
            if (sharedRuns >= 10) {
                data.put("color", COLOR_STRONG_LINK);
                data.put("width", 3.0);
                data.put("opacity", 0.95);
            } else if (sharedRuns >= 5) {
                data.put("color", COLOR_MEDIUM_LINK);
                data.put("width", 2.4);
                data.put("opacity", 0.9);
            } else {
                data.put("color", COLOR_LIGHT_LINK);
                data.put("width", 1.8);
                data.put("opacity", 0.7);
            }
            edges.add(new CytoscapeElement(data));
        }
        return edges;
    }

    private void addAlternateEdges(List<CytoscapeElement> edges, Long originId, Set<Long> alternateIds) {
        if (edges == null) {
            return;
        }
        if (originId == null || alternateIds == null || alternateIds.isEmpty()) {
            return;
        }
        for (Long alternateId : alternateIds) {
            if (alternateId == null) {
                continue;
            }
            Map<String, Object> data = new LinkedHashMap<>();
            String source = String.valueOf(Math.min(originId, alternateId));
            String target = String.valueOf(Math.max(originId, alternateId));
            data.put("id", source + "-alt-" + target);
            data.put("source", String.valueOf(originId));
            data.put("target", String.valueOf(alternateId));
            data.put("color", COLOR_ALT_LINK);
            data.put("lineStyle", "dashed");
            data.put("width", 2.2);
            data.put("opacity", 0.95);
            edges.add(new CytoscapeElement(data));
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

    private String safeName(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.strip();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private record Pair(Long left, Long right) {

        static Pair of(Long first, Long second) {
            if (first == null || second == null) {
                return null;
            }
            long min = Math.min(first, second);
            long max = Math.max(first, second);
            return new Pair(min, max);
        }

        String id() {
            return left + "-" + right;
        }

        boolean contains(Long playerId) {
            if (playerId == null) {
                return false;
            }
            return Objects.equals(left, playerId) || Objects.equals(right, playerId);
        }

        Long other(Long playerId) {
            if (!contains(playerId)) {
                return null;
            }
            return Objects.equals(left, playerId) ? right : left;
        }
    }
}
