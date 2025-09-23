package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Repository for {@link RunScorePlayer} association entities.
 */
@ApplicationScoped
public class RunScorePlayerRepository implements PanacheRepository<RunScorePlayer> {

    /**
     * Loads the player associations for the provided runs including the related player entity.
     *
     * @param runIds identifiers of the runs
     * @return association list ordered by run identifier and player name
     */
    public List<RunScorePlayer> listWithPlayersByRunIds(List<Long> runIds) {
        if (runIds == null || runIds.isEmpty()) {
            return List.of();
        }
        return find(
                        "SELECT rsp FROM RunScorePlayer rsp "
                                + "JOIN FETCH rsp.player "
                                + "WHERE rsp.runScore.id IN ?1 "
                                + "ORDER BY rsp.runScore.id ASC, LOWER(rsp.player.playerName) ASC",
                        runIds)
                .list();
    }

    /**
     * Lists all score player associations for the specified player.
     *
     * @param playerId identifier of the player
     * @return association list
     */
    public List<RunScorePlayer> listByPlayerId(Long playerId) {
        if (playerId == null) {
            return List.of();
        }
        return list("player.id", playerId);
    }

    /**
     * Lists the identifiers of runs already linked to the provided player.
     *
     * @param playerId identifier of the player
     * @return set of run identifiers
     */
    public Set<Long> listRunIdsByPlayer(Long playerId) {
        if (playerId == null) {
            return Set.of();
        }
        return list("player.id", playerId)
                .stream()
                .map(association -> association.getRunScore().getId())
                .collect(Collectors.toSet());
    }

    /**
     * Counts the score runs associated with the provided player.
     *
     * @param playerId identifier of the player
     * @return number of linked score runs
     */
    public long countByPlayerId(Long playerId) {
        if (playerId == null) {
            return 0L;
        }
        return count("player.id", playerId);
    }

    /**
     * Counts score runs for a set of player identifiers.
     *
     * @param playerIds identifiers of the players
     * @return mapping between player identifier and associated run count
     */
    public Map<Long, Long> countByPlayerIds(List<Long> playerIds) {
        if (playerIds == null || playerIds.isEmpty()) {
            return Map.of();
        }
        List<Object[]> rows = getEntityManager()
                .createQuery(
                        "SELECT rsp.player.id, COUNT(rsp) FROM RunScorePlayer rsp "
                                + "WHERE rsp.player.id IN :playerIds GROUP BY rsp.player.id",
                        Object[].class)
                .setParameter("playerIds", playerIds)
                .getResultList();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2) {
                continue;
            }
            Object playerId = row[0];
            Object count = row[1];
            if (playerId instanceof Number && count instanceof Number) {
                counts.put(((Number) playerId).longValue(), ((Number) count).longValue());
            }
        }
        return counts;
    }
}
