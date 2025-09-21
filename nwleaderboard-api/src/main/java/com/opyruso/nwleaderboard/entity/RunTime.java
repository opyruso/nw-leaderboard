package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Entity representing the completion time for a dungeon run.
 */
@Entity
@Table(name = "run_time")
public class RunTime extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_run")
    private Long id;

    @Column(name = "week", nullable = false)
    private Integer week;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_dungeon", nullable = false)
    private Dungeon dungeon;

    @Column(name = "time_in_second", nullable = false)
    private Integer timeInSecond;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getWeek() {
        return week;
    }

    public void setWeek(Integer week) {
        this.week = week;
    }

    public Dungeon getDungeon() {
        return dungeon;
    }

    public void setDungeon(Dungeon dungeon) {
        this.dungeon = dungeon;
    }

    public Integer getTimeInSecond() {
        return timeInSecond;
    }

    public void setTimeInSecond(Integer timeInSecond) {
        this.timeInSecond = timeInSecond;
    }
}
