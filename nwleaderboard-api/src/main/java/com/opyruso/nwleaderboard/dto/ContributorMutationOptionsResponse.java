package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload listing all selectable values when configuring weekly mutations.
 */
public record ContributorMutationOptionsResponse(
        List<ContributorMutationDungeonOption> dungeons,
        List<String> elements,
        List<String> types,
        List<String> promotions,
        List<String> curses) {}
