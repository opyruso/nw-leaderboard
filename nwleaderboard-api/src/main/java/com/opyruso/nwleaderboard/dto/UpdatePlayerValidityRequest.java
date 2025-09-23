package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request toggling the validity state of a player.
 */
public record UpdatePlayerValidityRequest(@JsonProperty("valid") Boolean valid) {}
