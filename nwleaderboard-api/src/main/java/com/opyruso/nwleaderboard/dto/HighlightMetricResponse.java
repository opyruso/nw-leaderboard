package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Describes the best recorded metric (score or time) for a highlighted dungeon.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record HighlightMetricResponse(
        Integer value,
        Integer week,
        Integer position,
        List<LeaderboardPlayerResponse> players,
        @JsonProperty("mutation_type_id") String mutationTypeId,
        @JsonProperty("mutation_promotion_id") String mutationPromotionId,
        @JsonProperty("mutation_curse_id") String mutationCurseId) {

    public HighlightMetricResponse {
        players = players == null ? List.of() : List.copyOf(players);
    }
}
