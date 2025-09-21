package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Describes the raw OCR output and associated crop for a specific region of the contributor screenshot.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributionFieldExtractionDto(
        @JsonProperty("text") String text,
        @JsonProperty("normalized") String normalized,
        @JsonProperty("number") Integer number,
        @JsonProperty("id") Long id,
        @JsonProperty("crop") String crop) {
}
