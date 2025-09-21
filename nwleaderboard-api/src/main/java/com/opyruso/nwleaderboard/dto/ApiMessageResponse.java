package com.opyruso.nwleaderboard.dto;

import jakarta.validation.constraints.NotNull;

public record ApiMessageResponse(
        @NotNull String message,
        Integer code
) {
}
