package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload describing the relationship graph for a player.
 */
public record PlayerRelationshipGraphResponse(
        List<PlayerRelationshipNodeResponse> nodes, List<PlayerRelationshipEdgeResponse> links) {

    public PlayerRelationshipGraphResponse {
        nodes = nodes == null ? List.of() : List.copyOf(nodes);
        links = links == null ? List.of() : List.copyOf(links);
    }
}
