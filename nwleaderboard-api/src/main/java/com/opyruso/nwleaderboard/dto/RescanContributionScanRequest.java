package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Payload used to request a reprocessing of a stored scan with a forced offset.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RescanContributionScanRequest(
        @JsonProperty("offset") Integer offset) {
}
