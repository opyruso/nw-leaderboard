package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScore;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository for persisting {@link RunScore} entities extracted from contributor uploads.
 */
@ApplicationScoped
public class RunScoreRepository implements PanacheRepository<RunScore> {

    /**
     * Returns the highest score runs recorded for the provided dungeon.
     *
     * @param dungeonId identifier of the dungeon
     * @param limit maximum number of runs to return
     * @return list of runs ordered by score descending and week descending
     */
    public List<RunScore> listTopByDungeon(Long dungeonId, int limit) {
        if (dungeonId == null || limit <= 0) {
            return List.of();
        }
        return find("dungeon.id = ?1 ORDER BY score DESC, week DESC, id ASC", dungeonId)
                .page(Page.ofSize(limit))
                .list();
    }

    /**
     * Finds runs matching the provided dungeon, week and score.
     *
     * @param dungeonId identifier of the dungeon
     * @param week week of the run
     * @param score achieved score
     * @return list of matching runs or an empty list when no run matches the criteria
     */
    public List<RunScore> listByDungeonWeekAndScore(Long dungeonId, Integer week, Integer score) {
        if (dungeonId == null || week == null || score == null) {
            return List.of();
        }
        return find("dungeon.id = ?1 AND week = ?2 AND score = ?3", dungeonId, week, score).list();
    }
}
