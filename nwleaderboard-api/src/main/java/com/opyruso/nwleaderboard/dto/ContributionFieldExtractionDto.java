package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Describes the raw OCR output and associated preprocessed crop for a specific region of the contributor screenshot.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributionFieldExtractionDto(
        @JsonProperty("text") String text,
        @JsonProperty("normalized") String normalized,
        @JsonProperty("number") Integer number,
        @JsonProperty("id") Long id,
        @JsonProperty("crop") String crop,
        @JsonProperty("confidence") Double confidence,
        @JsonProperty("status") String status,
        @JsonProperty("already_exists") Boolean alreadyExists,
        @JsonProperty("details") Map<String, Object> details,
        @JsonProperty("confirmed") Boolean confirmed) {
}
