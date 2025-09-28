package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Response payload describing the mutation configuration for a dungeon in a given week.
 */
public record ContributorMutationEntryResponse(
        @JsonProperty("season_id") Integer seasonId,
        Integer week,
        @JsonProperty("dungeon_id") Long dungeonId,
        @JsonProperty("dungeon_names") Map<String, String> dungeonNames,
        @JsonProperty("mutation_element_id") String mutationElementId,
        @JsonProperty("mutation_type_id") String mutationTypeId,
        @JsonProperty("mutation_promotion_id") String mutationPromotionId,
        @JsonProperty("mutation_curse_id") String mutationCurseId) {}
