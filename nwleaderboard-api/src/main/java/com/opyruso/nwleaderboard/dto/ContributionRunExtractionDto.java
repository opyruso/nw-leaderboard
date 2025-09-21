package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Represents the OCR outcome for a single leaderboard row, including all player slots and the score/time cell.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributionRunExtractionDto(
        @JsonProperty("index") int index,
        @JsonProperty("mode") String mode,
        @JsonProperty("score") Integer score,
        @JsonProperty("time") Integer time,
        @JsonProperty("value") ContributionFieldExtractionDto value,
        @JsonProperty("players") List<ContributionFieldExtractionDto> players) {
}
