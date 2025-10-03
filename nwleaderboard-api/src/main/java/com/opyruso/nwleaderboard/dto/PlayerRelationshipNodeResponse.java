package com.opyruso.nwleaderboard.dto;

/**
 * Describes a node displayed in the player relationship graph.
 */
public record PlayerRelationshipNodeResponse(
        Long id,
        String label,
        String category,
        String color) {}
