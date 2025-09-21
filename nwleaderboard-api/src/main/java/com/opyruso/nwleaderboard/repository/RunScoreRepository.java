package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScore;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link RunScore} entities.
 */
@ApplicationScoped
public class RunScoreRepository implements PanacheRepository<RunScore> {

    /**
     * Returns the list of {@link RunScore} entries for the requested dungeon ordered by score.
     *
     * @param dungeonId identifier of the dungeon
     * @return ordered list of run scores for the dungeon
     */
    public List<RunScore> listByDungeonId(Long dungeonId) {
        return find("dungeon.id = ?1 ORDER BY score DESC, week ASC, id ASC", dungeonId).list();
    }
}
