package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request payload used to update a stored run.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributorRunUpdateRequest(
        Integer week,
        String region,
        Integer score,
        Integer time,
        @JsonProperty("replacement") ContributorRunReplacementRequest replacement) {}
