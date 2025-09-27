package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request payload used when updating an existing weekly mutation entry.
 */
public record ContributorMutationUpdateRequest(
        @JsonProperty("mutation_element_id") String mutationElementId,
        @JsonProperty("mutation_type_id") String mutationTypeId,
        @JsonProperty("mutation_promotion_id") String mutationPromotionId,
        @JsonProperty("mutation_curse_id") String mutationCurseId) {}
