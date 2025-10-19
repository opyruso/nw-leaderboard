package com.opyruso.nwleaderboard.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Request body for updating weekly limits of a custom character.
 */
public record CustomCharacterLimitUpdateRequest(
        @NotNull @Min(0) @Max(4000) Integer weekUmbralsCap,
        @NotNull @Min(0) @Max(2) Integer weekWinterLimit,
        @NotNull @Min(0) @Max(2) Integer weekHatcheryLimit) {}
