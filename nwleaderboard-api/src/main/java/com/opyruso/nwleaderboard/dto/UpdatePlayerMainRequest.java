package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request payload allowing contributors to link a player to a main character.
 */
public record UpdatePlayerMainRequest(@JsonProperty("main_name") String mainName) {}
