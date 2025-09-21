package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/**
 * Composite identifier for the run_time_player association table.
 */
@Embeddable
public class RunTimePlayerId implements Serializable {

    private static final long serialVersionUID = 1L;

    @Column(name = "id_run")
    private Long runId;

    @Column(name = "id_player")
    private Long playerId;

    public RunTimePlayerId() {
    }

    public RunTimePlayerId(Long runId, Long playerId) {
        this.runId = runId;
        this.playerId = playerId;
    }

    public Long getRunId() {
        return runId;
    }

    public void setRunId(Long runId) {
        this.runId = runId;
    }

    public Long getPlayerId() {
        return playerId;
    }

    public void setPlayerId(Long playerId) {
        this.playerId = playerId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof RunTimePlayerId that)) {
            return false;
        }
        return Objects.equals(runId, that.runId) && Objects.equals(playerId, that.playerId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(runId, playerId);
    }
}
