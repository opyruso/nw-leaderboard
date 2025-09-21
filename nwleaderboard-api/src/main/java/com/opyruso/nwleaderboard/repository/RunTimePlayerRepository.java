package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunTimePlayer;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository for {@link RunTimePlayer} association entities.
 */
@ApplicationScoped
public class RunTimePlayerRepository implements PanacheRepository<RunTimePlayer> {

    /**
     * Loads the player associations for the provided time runs including the related player entity.
     *
     * @param runIds identifiers of the runs
     * @return association list ordered by run identifier and player name
     */
    public List<RunTimePlayer> listWithPlayersByRunIds(List<Long> runIds) {
        if (runIds == null || runIds.isEmpty()) {
            return List.of();
        }
        return find(
                        "SELECT rtp FROM RunTimePlayer rtp "
                                + "JOIN FETCH rtp.player "
                                + "WHERE rtp.runTime.id IN ?1 "
                                + "ORDER BY rtp.runTime.id ASC, LOWER(rtp.player.playerName) ASC",
                        runIds)
                .list();
    }
}
