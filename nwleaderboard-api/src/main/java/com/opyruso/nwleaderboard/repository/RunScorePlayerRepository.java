package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

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
}
