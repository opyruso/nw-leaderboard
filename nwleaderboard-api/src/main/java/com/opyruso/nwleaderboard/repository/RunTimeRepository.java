package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunTime;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link RunTime} entities.
 */
@ApplicationScoped
public class RunTimeRepository implements PanacheRepository<RunTime> {

    /**
     * Returns the list of {@link RunTime} entries for the requested dungeon ordered by completion time.
     *
     * @param dungeonId identifier of the dungeon
     * @return ordered list of run times for the dungeon
     */
    public List<RunTime> listByDungeonId(Long dungeonId) {
        return find("dungeon.id = ?1 ORDER BY timeInSecond ASC, week ASC, id ASC", dungeonId).list();
    }
}
