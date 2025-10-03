package com.opyruso.nwleaderboard.dto;

/**
 * Describes an edge displayed in the player relationship graph.
 */
public record PlayerRelationshipEdgeResponse(
        String id,
        Long source,
        Long target,
        String category,
        String color,
        String lineStyle,
        double width,
        long sharedRuns) {}
