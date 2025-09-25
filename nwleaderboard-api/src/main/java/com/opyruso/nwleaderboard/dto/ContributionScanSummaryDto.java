package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Lightweight description of a stored leaderboard scan awaiting validation.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributionScanSummaryDto(
        @JsonProperty("id") Long id,
        @JsonProperty("week") Integer week,
        @JsonProperty("dungeon_id") Long dungeonId,
        @JsonProperty("leaderboard_type") String leaderboardType,
        @JsonProperty("created_at") String createdAt) {
}
