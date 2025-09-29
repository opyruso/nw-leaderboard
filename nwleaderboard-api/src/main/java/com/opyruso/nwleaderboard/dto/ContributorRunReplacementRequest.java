package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request payload describing a player replacement within a run.
 */
public record ContributorRunReplacementRequest(
        @JsonProperty("player_id") Long playerId,
        @JsonProperty("replacement_player_id") Long replacementPlayerId) {}
