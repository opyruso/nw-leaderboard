package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunTime;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository for {@link RunTime} entities extracted from contributor uploads.
 */
@ApplicationScoped
public class RunTimeRepository implements PanacheRepository<RunTime> {

    /**
     * Returns the fastest runs recorded for the provided dungeon.
     *
     * @param dungeonId identifier of the dungeon
     * @param limit maximum number of runs to return
     * @return list of runs ordered by duration ascending and week descending
     */
    public List<RunTime> listTopByDungeon(Long dungeonId, int limit) {
        if (dungeonId == null || limit <= 0) {
            return List.of();
        }
        return find("dungeon.id = ?1 ORDER BY timeInSecond ASC, week DESC, id ASC", dungeonId)
                .page(Page.ofSize(limit))
                .list();
    }
}
