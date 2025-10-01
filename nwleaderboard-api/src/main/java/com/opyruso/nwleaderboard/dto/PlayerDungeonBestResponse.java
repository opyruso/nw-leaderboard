package com.opyruso.nwleaderboard.dto;

import java.util.Map;

/**
 * Response payload describing the best results achieved by a player for a specific dungeon.
 */
public record PlayerDungeonBestResponse(
        Long dungeonId,
        String fallbackName,
        Map<String, String> names,
        boolean highlighted,
        Integer bestScore,
        Integer bestScoreWeek,
        Integer bestScorePosition,
        Integer minScore,
        Integer maxScore,
        Integer bestTime,
        Integer bestTimeWeek,
        Integer bestTimePosition,
        Integer minTime,
        Integer maxTime) {

    public PlayerDungeonBestResponse {
        names = names == null ? Map.of() : Map.copyOf(names);
    }
}

