package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request payload used when updating an existing season entry.
 */
public record ContributorSeasonUpdateRequest(
        Integer id,
        @JsonProperty("previous_id") Integer previousId,
        @JsonProperty("date_begin") String dateBegin,
        @JsonProperty("date_end") String dateEnd) {}
