package com.opyruso.nwleaderboard.dto;

/**
 * Response payload for individual player ranking entries.
 */
public record IndividualRankingEntryResponse(
        Long playerId,
        String playerName,
        String region,
        int points,
        int scorePoints,
        int timePoints) {}
