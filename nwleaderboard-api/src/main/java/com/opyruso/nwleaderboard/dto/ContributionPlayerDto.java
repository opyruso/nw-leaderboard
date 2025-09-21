package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * DTO describing a player extracted from a contributor upload.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributionPlayerDto(
        @JsonProperty("player_name") String playerName,
        @JsonProperty("id_player") Long playerId) {
}
