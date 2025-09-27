package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Region;
import com.opyruso.nwleaderboard.entity.RunScore;
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
     * Returns a page of score runs ordered by score for the provided dungeon.
     */
    public List<RunScore> listTopByDungeonPaged(Long dungeonId, int pageIndex, int pageSize) {
        if (dungeonId == null || pageIndex < 0 || pageSize <= 0) {
            return List.of();
        }
        return find("dungeon.id = ?1 ORDER BY score DESC, week DESC, id ASC", dungeonId)
                .page(Page.of(pageIndex, pageSize))
                .list();
    }

    public List<RunScore> listByDungeonAndWeeks(
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
        query.append(" ORDER BY score DESC, week DESC, id ASC");
        return find(query.toString(), parameters).page(Page.of(pageIndex, pageSize)).list();
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
     * Returns the single best score recorded for the provided dungeon or {@code null} when none is available.
     */
    public RunScore findBestByDungeon(Long dungeonId) {
        if (dungeonId == null) {
            return null;
        }
        return find("dungeon.id = ?1 ORDER BY score DESC, week DESC, id ASC", dungeonId).firstResult();
    }

    /**
     * Calculates the ranking position of the provided run within its dungeon leaderboard.
     *
     * @param run run whose position should be determined
     * @return one-based position or {@code null} when it cannot be determined
     */
    public Integer findPositionInDungeon(RunScore run) {
        if (run == null) {
            return null;
        }
        Long dungeonId = run.getDungeon() != null ? run.getDungeon().getId() : null;
        Integer score = run.getScore();
        Integer week = run.getWeek();
        Long runId = run.getId();
        if (dungeonId == null || score == null) {
            return null;
        }

        Long safeRunId = runId != null ? runId : Long.MAX_VALUE;
        Long betterCount = getEntityManager()
                .createQuery(
                        "SELECT COUNT(other) FROM RunScore other "
                                + "WHERE other.dungeon.id = :dungeonId "
                                + "AND (other.score > :score "
                                + "OR (other.score = :score AND COALESCE(other.week, -1) > COALESCE(:week, -1)) "
                                + "OR (other.score = :score AND COALESCE(other.week, -1) = COALESCE(:week, -1) AND other.id < :runId))",
                        Long.class)
                .setParameter("dungeonId", dungeonId)
                .setParameter("score", score)
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
     * Finds runs matching the provided dungeon, week and score.
     *
     * @param dungeonId identifier of the dungeon
     * @param week week of the run
     * @param score achieved score
     * @return list of matching runs or an empty list when no run matches the criteria
     */
    public List<RunScore> listByDungeonWeekAndScore(Long dungeonId, Integer week, Integer score, Region region) {
        if (dungeonId == null || week == null || score == null) {
            return List.of();
        }
        String regionId = region != null ? region.getId() : null;
        if (regionId == null || regionId.isBlank()) {
            return find("dungeon.id = ?1 AND week = ?2 AND score = ?3", dungeonId, week, score).list();
        }
        return find(
                        "dungeon.id = :dungeonId AND week = :week AND score = :score AND region.id = :region",
                        Parameters.with("dungeonId", dungeonId)
                                .and("week", week)
                                .and("score", score)
                                .and("region", regionId))
                .list();
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

    /** Returns the lowest score recorded for each provided dungeon identifier. */
    public Map<Long, Integer> findMinimumScoresByDungeonIds(Collection<Long> dungeonIds) {
        if (dungeonIds == null || dungeonIds.isEmpty()) {
            return Map.of();
        }
        List<Object[]> rows = getEntityManager()
                .createQuery(
                        "SELECT run.dungeon.id, MIN(run.score) FROM RunScore run WHERE run.dungeon.id IN ?1 GROUP BY run.dungeon.id",
                        Object[].class)
                .setParameter(1, dungeonIds)
                .getResultList();
        Map<Long, Integer> result = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2) {
                continue;
            }
            Object dungeonId = row[0];
            Object score = row[1];
            if (!(dungeonId instanceof Long) || !(score instanceof Number)) {
                continue;
            }
            result.put((Long) dungeonId, ((Number) score).intValue());
        }
        return result;
    }

    /** Returns the highest score recorded for each provided dungeon identifier. */
    public Map<Long, Integer> findMaximumScoresByDungeonIds(Collection<Long> dungeonIds) {
        if (dungeonIds == null || dungeonIds.isEmpty()) {
            return Map.of();
        }
        List<Object[]> rows = getEntityManager()
                .createQuery(
                        "SELECT run.dungeon.id, MAX(run.score) FROM RunScore run WHERE run.dungeon.id IN ?1 GROUP BY run.dungeon.id",
                        Object[].class)
                .setParameter(1, dungeonIds)
                .getResultList();
        Map<Long, Integer> result = new HashMap<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2) {
                continue;
            }
            Object dungeonId = row[0];
            Object score = row[1];
            if (!(dungeonId instanceof Long) || !(score instanceof Number)) {
                continue;
            }
            result.put((Long) dungeonId, ((Number) score).intValue());
        }
        return result;
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

    /** Returns a nested map containing the number of score runs grouped by week and region. */
    public Map<Integer, Map<String, Long>> countRunsGroupedByWeekAndRegion() {
        List<Object[]> rows = getEntityManager()
                .createQuery(
                        "SELECT run.week, run.region.id, COUNT(run) FROM RunScore run GROUP BY run.week, run.region.id",
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
