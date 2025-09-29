package com.opyruso.nwleaderboard.dto;

import java.time.LocalDate;

/**
 * Public representation of a gameplay season.
 */
public record SeasonResponse(Integer id, LocalDate dateBegin, LocalDate dateEnd) {}

