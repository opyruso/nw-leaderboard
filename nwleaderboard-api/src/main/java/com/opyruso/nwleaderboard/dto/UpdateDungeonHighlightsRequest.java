package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Request payload containing the list of dungeon identifiers that should be marked as highlighted.
 */
public record UpdateDungeonHighlightsRequest(@JsonProperty("highlighted_ids") List<Long> highlightedIds) {}
