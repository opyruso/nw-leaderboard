package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request payload to create a new suggestion.
 */
public record SuggestionRequest(
        @JsonProperty("title") @NotBlank @Size(max = 200) String title,
        @JsonProperty("content") @NotBlank @Size(max = 5000) String content) {
}
