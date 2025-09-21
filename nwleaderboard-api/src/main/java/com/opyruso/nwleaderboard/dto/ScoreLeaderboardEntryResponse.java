package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload describing a leaderboard entry ordered by score.
 *
 * @param id      unique identifier of the dungeon run
 * @param week    week number for which the score was recorded
 * @param score   total score achieved by the party
 * @param players list of player display names participating in the run
 */
public record ScoreLeaderboardEntryResponse(Long id, Integer week, Integer score, List<String> players) {}
