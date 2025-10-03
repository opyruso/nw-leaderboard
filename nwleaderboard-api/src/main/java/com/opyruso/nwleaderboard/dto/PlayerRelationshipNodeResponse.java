package com.opyruso.nwleaderboard.dto;

/** Node entry for the player relationship graph payload. */
public record PlayerRelationshipNodeResponse(Long id, String label, String type, String color) {

    public PlayerRelationshipNodeResponse {
        if (label != null) {
            label = label.trim();
            if (label.isEmpty()) {
                label = null;
            }
        }
        if (type != null) {
            type = type.trim();
            if (type.isEmpty()) {
                type = null;
            }
        }
        if (color != null) {
            color = color.trim();
            if (color.isEmpty()) {
                color = null;
            }
        }
    }
}
