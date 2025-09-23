package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Describes the best recorded metric (score or time) for a highlighted dungeon.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record HighlightMetricResponse(Integer value, Integer week, List<LeaderboardPlayerResponse> players) {}
