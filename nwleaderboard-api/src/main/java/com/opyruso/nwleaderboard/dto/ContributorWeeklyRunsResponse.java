package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Summary of the number of runs recorded for a specific week.
 */
public record ContributorWeeklyRunsResponse(
        @JsonProperty("week") Integer week,
        @JsonProperty("score_runs") Long scoreRuns,
        @JsonProperty("time_runs") Long timeRuns) {}
