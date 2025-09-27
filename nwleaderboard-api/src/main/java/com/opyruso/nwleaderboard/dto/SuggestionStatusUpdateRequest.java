package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

/**
 * Request payload to update the status of an existing suggestion.
 */
public record SuggestionStatusUpdateRequest(
        @JsonProperty("status") @NotBlank String status) {
}
