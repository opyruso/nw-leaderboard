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
}
