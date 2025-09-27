package com.opyruso.nwleaderboard.dto;

import java.util.Objects;

/**
 * Response payload describing a player appearing in a leaderboard entry.
 */
public record LeaderboardPlayerResponse(Long playerId, String playerName, Long mainPlayerId, String mainPlayerName) {

    public LeaderboardPlayerResponse {
        playerName = normalise(playerName);
        mainPlayerName = normalise(mainPlayerName);
        if (mainPlayerId != null && Objects.equals(mainPlayerId, playerId)) {
            mainPlayerId = null;
            mainPlayerName = null;
        }
    }

    private static String normalise(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

