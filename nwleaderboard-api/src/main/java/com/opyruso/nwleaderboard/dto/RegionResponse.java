package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * DTO exposing available leaderboard regions.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RegionResponse(@JsonProperty("id") String id) {}
