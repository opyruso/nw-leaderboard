package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request to update a player's display name.
 */
public record UpdatePlayerNameRequest(@JsonProperty("player_name") String playerName) {}
