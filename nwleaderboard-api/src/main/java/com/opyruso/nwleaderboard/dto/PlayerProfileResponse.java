package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload aggregating the leaderboard highlights for a single player.
 */
public record PlayerProfileResponse(
        Long playerId,
        String playerName,
        Long mainPlayerId,
        String mainPlayerName,
        List<PlayerDungeonBestResponse> dungeons) {

    public PlayerProfileResponse {
        if (playerName != null) {
            playerName = playerName.strip();
        }
        if (mainPlayerName != null) {
            mainPlayerName = mainPlayerName.strip();
            if (mainPlayerName.isEmpty()) {
                mainPlayerName = null;
            }
        }
        if (mainPlayerId != null && mainPlayerId.equals(playerId)) {
            mainPlayerId = null;
            mainPlayerName = null;
        }
        dungeons = dungeons == null ? List.of() : List.copyOf(dungeons);
    }
}

