package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request payload used when creating a new season entry.
 */
public record ContributorSeasonCreateRequest(
        Integer id,
        @JsonProperty("date_begin") String dateBegin,
        @JsonProperty("date_end") String dateEnd) {}
