package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Cytoscape-compatible representation of a player's relationships.
 */
public record PlayerRelationshipGraphResponse(
        List<PlayerRelationshipNodeResponse> nodes,
        List<PlayerRelationshipEdgeResponse> edges) {

    public PlayerRelationshipGraphResponse {
        nodes = nodes == null ? List.of() : List.copyOf(nodes);
        edges = edges == null ? List.of() : List.copyOf(edges);
    }
}
