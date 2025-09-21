package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

/**
 * Association between a run score and the participating players.
 */
@Entity
@Table(name = "run_score_player")
public class RunScorePlayer extends Auditable {

    @EmbeddedId
    private RunScorePlayerId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("runId")
    @JoinColumn(name = "id_run", nullable = false)
    private RunScore runScore;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("playerId")
    @JoinColumn(name = "id_player", nullable = false)
    private Player player;

    public RunScorePlayerId getId() {
        return id;
    }

    public void setId(RunScorePlayerId id) {
        this.id = id;
    }

    public RunScore getRunScore() {
        return runScore;
    }

    public void setRunScore(RunScore runScore) {
        this.runScore = runScore;
    }

    public Player getPlayer() {
        return player;
    }

    public void setPlayer(Player player) {
        this.player = player;
    }
}
