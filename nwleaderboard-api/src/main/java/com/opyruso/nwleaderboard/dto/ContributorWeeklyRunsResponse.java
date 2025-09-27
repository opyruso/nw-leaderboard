package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Summary of the number of runs recorded for a specific week.
 */
public record ContributorWeeklyRunsResponse(
        @JsonProperty("week") Integer week,
        @JsonProperty("score_runs") Map<String, Long> scoreRuns,
        @JsonProperty("time_runs") Map<String, Long> timeRuns) {}
