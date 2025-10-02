package com.opyruso.nwleaderboard.dto;

/**
 * Represents a connection between two players in the relationship graph.
 */
public record PlayerRelationshipEdgeResponse(
        Long sourcePlayerId,
        Long targetPlayerId,
        Long runCount,
        boolean alternateLink) {

    public PlayerRelationshipEdgeResponse {
        if (runCount != null && runCount.longValue() < 0L) {
            runCount = 0L;
        }
    }
}
