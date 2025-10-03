package com.opyruso.nwleaderboard.dto;

/** Edge entry for the player relationship graph payload. */
public record PlayerRelationshipEdgeResponse(
        String id,
        Long sourceId,
        Long targetId,
        String category,
        Long runCount,
        String color,
        String lineStyle,
        Double width) {

    public PlayerRelationshipEdgeResponse {
        if (id != null) {
            id = id.trim();
            if (id.isEmpty()) {
                id = null;
            }
        }
        if (category != null) {
            category = category.trim();
            if (category.isEmpty()) {
                category = null;
            }
        }
        if (color != null) {
            color = color.trim();
            if (color.isEmpty()) {
                color = null;
            }
        }
        if (lineStyle != null) {
            lineStyle = lineStyle.trim();
            if (lineStyle.isEmpty()) {
                lineStyle = null;
            }
        }
        if (runCount != null && runCount < 0L) {
            runCount = 0L;
        }
        if (width != null && width < 0d) {
            width = 0d;
        }
    }
}
