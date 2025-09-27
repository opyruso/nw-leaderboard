package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Response payload representing a single leaderboard entry.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LeaderboardEntryResponse(
        Long entryId,
        Integer week,
        Integer value,
        Integer score,
        Integer time,
        List<LeaderboardPlayerResponse> players,
        @JsonProperty("mutation_type_id") String mutationTypeId,
        @JsonProperty("mutation_promotion_id") String mutationPromotionId,
        @JsonProperty("mutation_curse_id") String mutationCurseId) {

    public LeaderboardEntryResponse {
        players = players == null ? List.of() : List.copyOf(players);
    }
}
