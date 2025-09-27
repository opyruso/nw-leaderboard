package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Payload used to persist intermediate validation progress for a stored scan.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record UpdateContributionScanRequest(
        @JsonProperty("week") Integer week,
        @JsonProperty("dungeon_id") Long dungeonId,
        @JsonProperty("leaderboard_type") String leaderboardType,
        @JsonProperty("region") String region,
        @JsonProperty("extraction") ContributionExtractionResponseDto extraction) {
}
