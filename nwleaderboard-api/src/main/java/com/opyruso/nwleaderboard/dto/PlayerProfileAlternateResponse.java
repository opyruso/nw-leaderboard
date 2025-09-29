package com.opyruso.nwleaderboard.dto;

/**
 * Lightweight summary of an alternate character linked to a main account.
 */
public record PlayerProfileAlternateResponse(Long playerId, String playerName) {

    public PlayerProfileAlternateResponse {
        if (playerName != null) {
            playerName = playerName.strip();
            if (playerName.isEmpty()) {
                playerName = null;
            }
        }
    }
}
