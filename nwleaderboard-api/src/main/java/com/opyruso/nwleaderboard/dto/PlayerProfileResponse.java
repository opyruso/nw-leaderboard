package com.opyruso.nwleaderboard.dto;

import java.util.List;
import java.util.Locale;

/**
 * Response payload aggregating the leaderboard highlights for a single player.
 */
public record PlayerProfileResponse(
        Long playerId,
        String playerName,
        String region,
        Long mainPlayerId,
        String mainPlayerName,
        List<PlayerDungeonBestResponse> dungeons) {

    public PlayerProfileResponse {
        if (playerName != null) {
            playerName = playerName.strip();
        }
        if (region != null) {
            String trimmed = region.strip();
            region = trimmed.isEmpty() ? null : trimmed.toUpperCase(Locale.ROOT);
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

