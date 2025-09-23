package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
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
        return find("SELECT rsp.runScore.id FROM RunScorePlayer rsp WHERE rsp.player.id = ?1", playerId)
                .list()
                .stream()
                .map(result -> (Long) result)
                .collect(Collectors.toSet());
    }
}
