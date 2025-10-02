package com.opyruso.nwleaderboard.dto;

/**
 * Describes a node of the player relationship graph.
 */
public record PlayerRelationshipNodeResponse(
        Long playerId,
        String playerName,
        boolean origin,
        boolean alternate,
        Long runCount) {

    public PlayerRelationshipNodeResponse {
        if (playerName != null) {
            playerName = playerName.strip();
            if (playerName.isEmpty()) {
                playerName = null;
            }
        }
        if (runCount != null && runCount.longValue() < 0L) {
            runCount = 0L;
        }
    }
}
