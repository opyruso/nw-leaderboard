package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload aggregating the leaderboard highlights for a single player.
 */
public record PlayerProfileResponse(Long playerId, String playerName, List<PlayerDungeonBestResponse> dungeons) {

    public PlayerProfileResponse {
        if (playerName != null) {
            playerName = playerName.strip();
        }
        dungeons = dungeons == null ? List.of() : List.copyOf(dungeons);
    }
}

