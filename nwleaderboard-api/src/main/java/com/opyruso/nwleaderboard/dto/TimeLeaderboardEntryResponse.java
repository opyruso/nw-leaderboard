package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload describing a leaderboard entry ordered by completion time.
 *
 * @param id      unique identifier of the dungeon run
 * @param week    week number for which the time was recorded
 * @param time    completion time expressed in seconds
 * @param players list of player display names participating in the run
 */
public record TimeLeaderboardEntryResponse(Long id, Integer week, Integer time, List<String> players) {}
