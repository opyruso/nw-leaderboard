package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunTime;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Parameters;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.NoResultException;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    /**
     * Returns a page of time runs ordered by completion time for the provided dungeon.
     */
    public List<RunTime> listTopByDungeonPaged(Long dungeonId, int pageIndex, int pageSize) {
        if (dungeonId == null || pageIndex < 0 || pageSize <= 0) {
            return List.of();
        }
        return find("dungeon.id = ?1 ORDER BY timeInSecond ASC, week DESC, id ASC", dungeonId)
                .page(Page.of(pageIndex, pageSize))
                .list();
    }

    public List<RunTime> listByDungeonAndWeeks(Long dungeonId, List<Integer> weeks, int pageIndex, int pageSize) {
        if (dungeonId == null || pageIndex < 0 || pageSize <= 0) {
            return List.of();
        }
        if (weeks != null && weeks.isEmpty()) {
            return List.of();
        }
        if (weeks == null) {
            return find("dungeon.id = ?1 ORDER BY timeInSecond ASC, week DESC, id ASC", dungeonId)
                    .page(Page.of(pageIndex, pageSize))
                    .list();
        }
        return find(
                        "dungeon.id = :dungeonId AND week IN :weeks ORDER BY timeInSecond ASC, week DESC, id ASC",
                        Parameters.with("dungeonId", dungeonId).and("weeks", weeks))
                .page(Page.of(pageIndex, pageSize))
                .list();
    }

    public long countByDungeonAndWeeks(Long dungeonId, List<Integer> weeks) {
        if (dungeonId == null) {
            return 0L;
        }
        if (weeks != null && weeks.isEmpty()) {
            return 0L;
        }
        if (weeks == null) {
            return count("dungeon.id = ?1", dungeonId);
        }
        return count("dungeon.id = :dungeonId AND week IN :weeks", Parameters.with("dungeonId", dungeonId).and("weeks", weeks));
    }

    /**
     * Returns the fastest run recorded for the provided dungeon or {@code null} when none is available.
     */
    public RunTime findBestByDungeon(Long dungeonId) {
        if (dungeonId == null) {
            return null;
        }
        return find("dungeon.id = ?1 ORDER BY timeInSecond ASC, week DESC, id ASC", dungeonId).firstResult();
    }

    /**
     * Calculates the ranking position of the provided run within its dungeon leaderboard.
     *
     * @param run run whose position should be determined
     * @return one-based position or {@code null} when it cannot be determined
     */
    public Integer findPositionInDungeon(RunTime run) {
        if (run == null) {
            return null;
        }
        Long dungeonId = run.getDungeon() != null ? run.getDungeon().getId() : null;
        Integer time = run.getTimeInSecond();
        Integer week = run.getWeek();
        Long runId = run.getId();
        if (dungeonId == null || time == null) {
            return null;
        }

        Long safeRunId = runId != null ? runId : Long.MAX_VALUE;
        Long betterCount = getEntityManager()
                .createQuery(
                        "SELECT COUNT(other) FROM RunTime other "
                                + "WHERE other.dungeon.id = :dungeonId "
                                + "AND (other.timeInSecond < :time "
                                + "OR (other.timeInSecond = :time AND COALESCE(other.week, -1) > COALESCE(:week, -1)) "
                                + "OR (other.timeInSecond = :time AND COALESCE(other.week, -1) = COALESCE(:week, -1) AND other.id < :runId))",
                        Long.class)
                .setParameter("dungeonId", dungeonId)
                .setParameter("time", time)
                .setParameter("week", week)
                .setParameter("runId", safeRunId)
                .getSingleResult();
        if (betterCount == null) {
            return null;
        }
        long position = betterCount + 1;
        return position > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) position;
    }

    /**
     * Finds runs matching the provided dungeon, week and time.
     *
     * @param dungeonId identifier of the dungeon
     * @param week week of the run
     * @param time duration in seconds
     * @return list of matching runs or an empty list when no run matches the criteria
     */
    public List<RunTime> listByDungeonWeekAndTime(Long dungeonId, Integer week, Integer time) {
        if (dungeonId == null || week == null || time == null) {
            return List.of();
        }
        return find("dungeon.id = ?1 AND week = ?2 AND timeInSecond = ?3", dungeonId, week, time).list();
    }

    /**
     * Returns runs involving the provided player ordered with the fastest times first.
     *
     * @param playerId identifier of the player
     * @return list of runs sorted by duration ascending and week descending
     */
    public List<RunTime> listBestByPlayer(Long playerId) {
        if (playerId == null) {
            return List.of();
        }
        return find(
                        "SELECT DISTINCT run FROM RunTimePlayer rtp "
                                + "JOIN rtp.runTime run "
                                + "JOIN FETCH run.dungeon dungeon "
                                + "WHERE rtp.player.id = ?1 "
                                + "ORDER BY run.timeInSecond ASC, run.week DESC, run.id ASC",
                        playerId)
                .list();
    }

    /** Returns the fastest time recorded for each provided dungeon identifier. */
    public Map<Long, Integer> findMinimumTimesByDungeonIds(Collection<Long> dungeonIds) {
        if (dungeonIds == null || dungeonIds.isEmpty()) {
            return Map.of();
        }
        List<Object[]> rows = getEntityManager()
                .createQuery(
                        "SELECT run.dungeon.id, MIN(run.timeInSecond) FROM RunTime run WHERE run.dungeon.id IN ?1 GROUP BY run.dungeon.id",
                        Object[].class)
                .setParameter(1, dungeonIds)
                .getResultList();
        Map<Long, Integer> result = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2) {
                continue;
            }
            Object dungeonId = row[0];
            Object time = row[1];
            if (!(dungeonId instanceof Long) || !(time instanceof Number)) {
                continue;
            }
            result.put((Long) dungeonId, ((Number) time).intValue());
        }
        return result;
    }

    /** Returns the slowest time recorded for each provided dungeon identifier. */
    public Map<Long, Integer> findMaximumTimesByDungeonIds(Collection<Long> dungeonIds) {
        if (dungeonIds == null || dungeonIds.isEmpty()) {
            return Map.of();
        }
        List<Object[]> rows = getEntityManager()
                .createQuery(
                        "SELECT run.dungeon.id, MAX(run.timeInSecond) FROM RunTime run WHERE run.dungeon.id IN ?1 GROUP BY run.dungeon.id",
                        Object[].class)
                .setParameter(1, dungeonIds)
                .getResultList();
        Map<Long, Integer> result = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2) {
                continue;
            }
            Object dungeonId = row[0];
            Object time = row[1];
            if (!(dungeonId instanceof Long) || !(time instanceof Number)) {
                continue;
            }
            result.put((Long) dungeonId, ((Number) time).intValue());
        }
        return result;
    }

    /** Returns the highest recorded week for time runs or {@code null} when none exist. */
    public Integer findHighestWeek() {
        try {
            return getEntityManager()
                    .createQuery("SELECT MAX(run.week) FROM RunTime run", Integer.class)
                    .getSingleResult();
        } catch (NoResultException ignored) {
            return null;
        }
    }

    /** Returns a map containing the number of time runs grouped by week. */
    public Map<Integer, Long> countRunsGroupedByWeek() {
        List<Object[]> rows = getEntityManager()
                .createQuery("SELECT run.week, COUNT(run) FROM RunTime run GROUP BY run.week", Object[].class)
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
