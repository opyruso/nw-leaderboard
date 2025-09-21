package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

/**
 * Association between a run time and the participating players.
 */
@Entity
@Table(name = "run_time_player")
public class RunTimePlayer extends Auditable {

    @EmbeddedId
    private RunTimePlayerId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("runId")
    @JoinColumn(name = "id_run", nullable = false)
    private RunTime runTime;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("playerId")
    @JoinColumn(name = "id_player", nullable = false)
    private Player player;

    public RunTimePlayerId getId() {
        return id;
    }

    public void setId(RunTimePlayerId id) {
        this.id = id;
    }

    public RunTime getRunTime() {
        return runTime;
    }

    public void setRunTime(RunTime runTime) {
        this.runTime = runTime;
    }

    public Player getPlayer() {
        return player;
    }

    public void setPlayer(Player player) {
        this.player = player;
    }
}
