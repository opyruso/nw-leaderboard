package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Player information exposed to contributors.
 */
public record ContributorPlayerResponse(
        @JsonProperty("id") Long id,
        @JsonProperty("player_name") String playerName,
        @JsonProperty("valid") boolean valid,
        @JsonProperty("score_run_count") long scoreRunCount,
        @JsonProperty("time_run_count") long timeRunCount,
        @JsonProperty("total_run_count") long totalRunCount) {}
