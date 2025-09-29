package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Region;
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

    public List<RunTime> listByDungeonAndWeeks(
            Long dungeonId, List<Integer> weeks, Collection<String> regions, int pageIndex, int pageSize) {
        if (dungeonId == null || pageIndex < 0 || pageSize <= 0) {
            return List.of();
        }
        if (weeks != null && weeks.isEmpty()) {
            return List.of();
        }
        StringBuilder query = new StringBuilder("dungeon.id = :dungeonId");
        Parameters parameters = Parameters.with("dungeonId", dungeonId);
        if (weeks != null) {
            query.append(" AND week IN :weeks");
            parameters = parameters.and("weeks", weeks);
        }
        if (regions != null && !regions.isEmpty()) {
            query.append(" AND region.id IN :regions");
            parameters = parameters.and("regions", regions);
        }
        query.append(" ORDER BY timeInSecond ASC, week DESC, id ASC");
        return find(query.toString(), parameters).page(Page.of(pageIndex, pageSize)).list();
    }

    public List<Object[]> aggregateByDungeonAndWeeks(
            Long dungeonId, List<Integer> weeks, Collection<String> regions) {
        if (dungeonId == null) {
            return List.of();
        }
        if (weeks != null && weeks.isEmpty()) {
            return List.of();
        }
        StringBuilder query = new StringBuilder(
                "SELECT run.week, MAX(run.timeInSecond), MIN(run.timeInSecond), SUM(run.timeInSecond), COUNT(run.id) "
                        + "FROM RunTime run WHERE run.dungeon.id = :dungeonId");
        if (weeks != null) {
            query.append(" AND run.week IN :weeks");
        }
        if (regions != null && !regions.isEmpty()) {
            query.append(" AND run.region.id IN :regions");
        }
        query.append(" GROUP BY run.week");

        var typedQuery = getEntityManager().createQuery(query.toString(), Object[].class);
        typedQuery.setParameter("dungeonId", dungeonId);
        if (weeks != null) {
            typedQuery.setParameter("weeks", weeks);
        }
        if (regions != null && !regions.isEmpty()) {
            typedQuery.setParameter("regions", regions);
        }
        return typedQuery.getResultList();
    }

    public long countByDungeonAndWeeks(Long dungeonId, List<Integer> weeks, Collection<String> regions) {
        if (dungeonId == null) {
            return 0L;
        }
        if (weeks != null && weeks.isEmpty()) {
            return 0L;
        }
        StringBuilder query = new StringBuilder("dungeon.id = :dungeonId");
        Parameters parameters = Parameters.with("dungeonId", dungeonId);
        if (weeks != null) {
            query.append(" AND week IN :weeks");
            parameters = parameters.and("weeks", weeks);
        }
        if (regions != null && !regions.isEmpty()) {
            query.append(" AND region.id IN :regions");
            parameters = parameters.and("regions", regions);
        }
        return count(query.toString(), parameters);
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
    public List<RunTime> listByDungeonWeekAndTime(Long dungeonId, Integer week, Integer time, Region region) {
        if (dungeonId == null || week == null || time == null) {
            return List.of();
        }
        String regionId = region != null ? region.getId() : null;
        if (regionId == null || regionId.isBlank()) {
            return find("dungeon.id = ?1 AND week = ?2 AND timeInSecond = ?3", dungeonId, week, time).list();
        }
        return find(
                        "dungeon.id = :dungeonId AND week = :week AND timeInSecond = :time AND region.id = :region",
                        Parameters.with("dungeonId", dungeonId)
                                .and("week", week)
                                .and("time", time)
                                .and("region", regionId))
                .list();
    }

    /**
     * Returns runs involving the provided player ordered with the fastest times first.
     *
     * @param playerId identifier of the player
     * @return list of runs sorted by duration ascending and week descending
     */
    public List<RunTime> listBestByPlayer(Long playerId, Collection<Integer> weeks) {
        if (playerId == null || (weeks != null && weeks.isEmpty())) {
            return List.of();
        }
        StringBuilder jpql = new StringBuilder(
                "SELECT DISTINCT run FROM RunTimePlayer rtp "
                        + "JOIN rtp.runTime run "
                        + "JOIN FETCH run.dungeon dungeon "
                        + "WHERE rtp.player.id = :playerId");
        Parameters parameters = Parameters.with("playerId", playerId);
        if (weeks != null && !weeks.isEmpty()) {
            jpql.append(" AND run.week IN :weeks");
            parameters = parameters.and("weeks", weeks);
        }
        jpql.append(" ORDER BY run.timeInSecond ASC, run.week DESC, run.id ASC");
        return find(jpql.toString(), parameters).list();
    }

    /** Returns the fastest time recorded for each provided dungeon identifier. */
    public Map<Long, Integer> findMinimumTimesByDungeonIds(
            Collection<Long> dungeonIds, Collection<Integer> weeks) {
        if (dungeonIds == null || dungeonIds.isEmpty() || (weeks != null && weeks.isEmpty())) {
            return Map.of();
        }
        StringBuilder query = new StringBuilder(
                "SELECT run.dungeon.id, MIN(run.timeInSecond) FROM RunTime run WHERE run.dungeon.id IN :dungeons");
        if (weeks != null && !weeks.isEmpty()) {
            query.append(" AND run.week IN :weeks");
        }
        query.append(" GROUP BY run.dungeon.id");
        var typedQuery = getEntityManager().createQuery(query.toString(), Object[].class);
        typedQuery.setParameter("dungeons", dungeonIds);
        if (weeks != null && !weeks.isEmpty()) {
            typedQuery.setParameter("weeks", weeks);
        }
        List<Object[]> rows = typedQuery.getResultList();
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
    public Map<Long, Integer> findMaximumTimesByDungeonIds(
            Collection<Long> dungeonIds, Collection<Integer> weeks) {
        if (dungeonIds == null || dungeonIds.isEmpty() || (weeks != null && weeks.isEmpty())) {
            return Map.of();
        }
        StringBuilder query = new StringBuilder(
                "SELECT run.dungeon.id, MAX(run.timeInSecond) FROM RunTime run WHERE run.dungeon.id IN :dungeons");
        if (weeks != null && !weeks.isEmpty()) {
            query.append(" AND run.week IN :weeks");
        }
        query.append(" GROUP BY run.dungeon.id");
        var typedQuery = getEntityManager().createQuery(query.toString(), Object[].class);
        typedQuery.setParameter("dungeons", dungeonIds);
        if (weeks != null && !weeks.isEmpty()) {
            typedQuery.setParameter("weeks", weeks);
        }
        List<Object[]> rows = typedQuery.getResultList();
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

    /** Returns a nested map containing the number of time runs grouped by week and region. */
    public Map<Integer, Map<String, Long>> countRunsGroupedByWeekAndRegion() {
        List<Object[]> rows = getEntityManager()
                .createQuery(
                        "SELECT run.week, run.region.id, COUNT(run) FROM RunTime run GROUP BY run.week, run.region.id",
                        Object[].class)
                .getResultList();
        Map<Integer, Map<String, Long>> result = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 3) {
                continue;
            }
            Object weekValue = row[0];
            Object regionValue = row[1];
            Object countValue = row[2];
            if (!(weekValue instanceof Integer) || regionValue == null || !(countValue instanceof Number)) {
                continue;
            }
            Integer week = (Integer) weekValue;
            String region = regionValue.toString();
            long count = ((Number) countValue).longValue();
            result.computeIfAbsent(week, key -> new HashMap<>()).put(region, count);
        }
        return result;
    }
}
