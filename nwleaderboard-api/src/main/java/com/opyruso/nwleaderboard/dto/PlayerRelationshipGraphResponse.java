package com.opyruso.nwleaderboard.dto;

import java.util.List;

/**
 * Response payload describing the relationship graph for a player.
 */
public record PlayerRelationshipGraphResponse(
        PlayerRelationshipNodeResponse origin,
        List<PlayerRelationshipNodeResponse> alternates,
        List<PlayerRelationshipNodeResponse> relatedPlayers,
        List<PlayerRelationshipEdgeResponse> edges) {

    public PlayerRelationshipGraphResponse {
        alternates = alternates == null ? List.of() : List.copyOf(alternates);
        relatedPlayers = relatedPlayers == null ? List.of() : List.copyOf(relatedPlayers);
        edges = edges == null ? List.of() : List.copyOf(edges);
    }
}
