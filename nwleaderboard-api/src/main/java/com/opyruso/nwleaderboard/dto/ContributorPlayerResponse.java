package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Player information exposed to contributors.
 */
public record ContributorPlayerResponse(
        @JsonProperty("id") Long id,
        @JsonProperty("player_name") String playerName,
        @JsonProperty("valid") boolean valid) {}
