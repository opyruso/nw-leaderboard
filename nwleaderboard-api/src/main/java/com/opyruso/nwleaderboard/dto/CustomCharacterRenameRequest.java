package com.opyruso.nwleaderboard.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for renaming a custom character.
 */
public record CustomCharacterRenameRequest(
        @NotBlank @Size(max = 255) String name) {}
