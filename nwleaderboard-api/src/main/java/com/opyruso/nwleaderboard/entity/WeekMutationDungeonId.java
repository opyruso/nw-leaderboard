package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/**
 * Composite identifier for week mutation configuration per dungeon.
 */
@Embeddable
public class WeekMutationDungeonId implements Serializable {

    private static final long serialVersionUID = 1L;

    @Column(name = "week", nullable = false)
    private Integer week;

    @Column(name = "id_dungeon", nullable = false)
    private Long dungeonId;

    public WeekMutationDungeonId() {
    }

    public WeekMutationDungeonId(Integer week, Long dungeonId) {
        this.week = week;
        this.dungeonId = dungeonId;
    }

    public Integer getWeek() {
        return week;
    }

    public void setWeek(Integer week) {
        this.week = week;
    }

    public Long getDungeonId() {
        return dungeonId;
    }

    public void setDungeonId(Long dungeonId) {
        this.dungeonId = dungeonId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        WeekMutationDungeonId that = (WeekMutationDungeonId) o;
        return Objects.equals(week, that.week) && Objects.equals(dungeonId, that.dungeonId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(week, dungeonId);
    }
}
