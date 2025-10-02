package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload describing the relationship graph for a player.
 */
public record PlayerRelationshipGraphResponse(
        List<PlayerRelationshipNodeResponse> nodes, List<PlayerRelationshipEdgeResponse> edges) {

    public PlayerRelationshipGraphResponse {
        nodes = nodes == null ? List.of() : List.copyOf(nodes);
        edges = edges == null ? List.of() : List.copyOf(edges);
    }
}
