package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Response payload describing a highlighted dungeon and its best score/time entries.
 */
public record HighlightResponse(
        @JsonProperty("dungeon_id") Long dungeonId,
        String name,
        Map<String, String> names,
        @JsonProperty("player_count") Integer playerCount,
        @JsonProperty("best_score") HighlightMetricResponse bestScore,
        @JsonProperty("best_time") HighlightMetricResponse bestTime) {}
