package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Aggregates the OCR results for the uploaded screenshot, including context fields and per-row data.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributionExtractionResponseDto(
        @JsonProperty("week") ContributionFieldExtractionDto week,
        @JsonProperty("dungeon") ContributionFieldExtractionDto dungeon,
        @JsonProperty("mode") ContributionFieldExtractionDto mode,
        @JsonProperty("runs") List<ContributionRunExtractionDto> runs) {
}
