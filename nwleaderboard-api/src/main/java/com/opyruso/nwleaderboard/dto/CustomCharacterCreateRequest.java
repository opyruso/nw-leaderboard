package com.opyruso.nwleaderboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for creating a new custom character.
 */
public record CustomCharacterCreateRequest(
        @NotBlank @Size(max = 255) String name) {}
