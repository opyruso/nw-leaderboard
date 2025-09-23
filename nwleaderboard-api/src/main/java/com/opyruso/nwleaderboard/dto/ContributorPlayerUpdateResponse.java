package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response describing the outcome of a contributor player update.
 */
public record ContributorPlayerUpdateResponse(
        @JsonProperty("player") ContributorPlayerResponse player,
        @JsonProperty("removed_player_id") Long removedPlayerId) {}
