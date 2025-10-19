package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Aggregated response containing character data and available weeks.
 */
public record CustomCharacterOverviewResponse(
        Integer currentWeek,
        Integer selectedWeek,
        List<Integer> availableWeeks,
        List<CustomCharacterWeekResponse> characters) {}
