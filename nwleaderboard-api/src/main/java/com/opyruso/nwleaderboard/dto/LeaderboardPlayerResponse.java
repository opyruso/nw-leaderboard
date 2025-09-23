package com.opyruso.nwleaderboard.dto;

/**
 * Response payload describing a player appearing in a leaderboard entry.
 */
public record LeaderboardPlayerResponse(Long playerId, String playerName) {

    public LeaderboardPlayerResponse {
        if (playerName != null) {
            playerName = playerName.strip();
            if (playerName.isEmpty()) {
                playerName = null;
            }
        }
    }
}

