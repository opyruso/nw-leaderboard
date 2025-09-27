package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Option describing a dungeon available when configuring weekly mutations.
 */
public record ContributorMutationDungeonOption(
        Long id,
        @JsonProperty("names") Map<String, String> names) {}
