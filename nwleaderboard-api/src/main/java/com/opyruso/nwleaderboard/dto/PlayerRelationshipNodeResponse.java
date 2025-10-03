package com.opyruso.nwleaderboard.dto;

import java.util.Locale;

/**
 * Node entry used to render the player relationship graph.
 */
public record PlayerRelationshipNodeResponse(
        String id, String label, String category, String groupId, String groupLabel) {

    public PlayerRelationshipNodeResponse {
        id = normaliseId(id);
        label = normaliseLabel(label);
        category = normaliseCategory(category);
        groupId = normaliseId(groupId);
        groupLabel = normaliseLabel(groupLabel);
    }

    private String normaliseId(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normaliseLabel(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private String normaliseCategory(String value) {
        if (value == null) {
            return "other";
        }
        String trimmed = value.strip();
        if (trimmed.isEmpty()) {
            return "other";
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }
}
