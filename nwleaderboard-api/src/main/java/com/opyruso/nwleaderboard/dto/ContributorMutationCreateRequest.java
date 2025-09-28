package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request payload used when creating a new weekly mutation entry.
 */
public record ContributorMutationCreateRequest(
        Integer week,
        @JsonProperty("dungeon_id") Long dungeonId,
        @JsonProperty("season_id") Integer seasonId,
        @JsonProperty("mutation_element_id") String mutationElementId,
        @JsonProperty("mutation_type_id") String mutationTypeId,
        @JsonProperty("mutation_promotion_id") String mutationPromotionId,
        @JsonProperty("mutation_curse_id") String mutationCurseId) {}
