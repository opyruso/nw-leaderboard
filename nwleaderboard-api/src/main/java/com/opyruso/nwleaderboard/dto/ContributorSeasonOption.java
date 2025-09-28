package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;

/**
 * Response payload describing a selectable season.
 */
public record ContributorSeasonOption(
        Integer id,
        @JsonProperty("date_begin") LocalDate dateBegin,
        @JsonProperty("date_end") LocalDate dateEnd) {}
