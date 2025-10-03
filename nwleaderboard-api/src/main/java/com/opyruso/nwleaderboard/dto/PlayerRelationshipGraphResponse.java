package com.opyruso.nwleaderboard.dto;

import java.util.List;
import java.util.Map;

/**
 * Cytoscape-compatible graph payload describing the relationships around a player.
 */
public record PlayerRelationshipGraphResponse(
        List<CytoscapeElement> nodes, List<CytoscapeElement> edges) {

    public record CytoscapeElement(Map<String, Object> data) {}
}
