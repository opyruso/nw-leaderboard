package com.opyruso.nwleaderboard.dto;

/**
 * Response describing a character for a given week.
 */
public record CustomCharacterWeekResponse(
        Long id,
        String name,
        boolean deleted,
        Integer weekUmbralsCap,
        Integer weekWinterLimit,
        Integer weekHatcheryLimit) {}
