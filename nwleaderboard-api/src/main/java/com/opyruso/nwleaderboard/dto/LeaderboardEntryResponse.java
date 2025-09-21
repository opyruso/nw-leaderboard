package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload representing a single leaderboard entry.
 */
public record LeaderboardEntryResponse(
        Long entryId,
        Integer week,
        Integer value,
        Integer score,
        Integer time,
        List<String> players) {

    public LeaderboardEntryResponse {
        players = players == null ? List.of() : List.copyOf(players);
    }
}
