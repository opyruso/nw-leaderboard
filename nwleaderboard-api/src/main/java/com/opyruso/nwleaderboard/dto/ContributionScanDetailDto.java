package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Detailed representation of a stored leaderboard scan including the OCR payload.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributionScanDetailDto(
        @JsonProperty("id") Long id,
        @JsonProperty("week") Integer week,
        @JsonProperty("dungeon_id") Long dungeonId,
        @JsonProperty("leaderboard_type") String leaderboardType,
        @JsonProperty("width") Integer width,
        @JsonProperty("height") Integer height,
        @JsonProperty("picture") String picture,
        @JsonProperty("extraction") ContributionExtractionResponseDto extraction) {
}
