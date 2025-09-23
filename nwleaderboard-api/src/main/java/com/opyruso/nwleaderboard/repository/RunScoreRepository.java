package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScore;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.NoResultException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
     * Returns the single best score recorded for the provided dungeon or {@code null} when none is available.
     */
    public RunScore findBestByDungeon(Long dungeonId) {
        if (dungeonId == null) {
            return null;
        }
        return find("dungeon.id = ?1 ORDER BY score DESC, week DESC, id ASC", dungeonId).firstResult();
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

    /**
     * Returns runs involving the provided player ordered with the best scores first.
     *
     * @param playerId identifier of the player
     * @return list of runs sorted by score descending and week descending
     */
    public List<RunScore> listBestByPlayer(Long playerId) {
        if (playerId == null) {
            return List.of();
        }
        return find(
                        "SELECT DISTINCT run FROM RunScorePlayer rsp "
                                + "JOIN rsp.runScore run "
                                + "JOIN FETCH run.dungeon dungeon "
                                + "WHERE rsp.player.id = ?1 "
                                + "ORDER BY run.score DESC, run.week DESC, run.id ASC",
                        playerId)
                .list();
    }

    /** Returns the highest week number stored for score runs or {@code null} when none is available. */
    public Integer findHighestWeek() {
        try {
            return getEntityManager()
                    .createQuery("SELECT MAX(run.week) FROM RunScore run", Integer.class)
                    .getSingleResult();
        } catch (NoResultException ignored) {
            return null;
        }
    }

    /** Returns a map containing the number of score runs grouped by week. */
    public Map<Integer, Long> countRunsGroupedByWeek() {
        List<Object[]> rows = getEntityManager()
                .createQuery(
                        "SELECT run.week, COUNT(run) FROM RunScore run GROUP BY run.week",
                        Object[].class)
                .getResultList();
        Map<Integer, Long> result = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2) {
                continue;
            }
            Object weekValue = row[0];
            Object countValue = row[1];
            if (!(weekValue instanceof Integer) || countValue == null) {
                continue;
            }
            long count;
            if (countValue instanceof Long longValue) {
                count = longValue;
            } else if (countValue instanceof Number number) {
                count = number.longValue();
            } else {
                continue;
            }
            result.put((Integer) weekValue, count);
        }
        return result;
    }
}
