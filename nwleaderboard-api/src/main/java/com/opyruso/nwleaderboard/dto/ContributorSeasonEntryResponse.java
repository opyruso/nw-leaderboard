package com.opyruso.nwleaderboard.dto;

import java.time.LocalDate;

/**
 * Response payload exposing a season entry for contributor management.
 */
public record ContributorSeasonEntryResponse(Integer id, LocalDate dateBegin, LocalDate dateEnd) {}
