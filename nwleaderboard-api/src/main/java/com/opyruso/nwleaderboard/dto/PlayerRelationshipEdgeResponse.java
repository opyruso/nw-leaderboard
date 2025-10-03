package com.opyruso.nwleaderboard.dto;

import java.util.Locale;

/**
 * Edge entry describing the number of shared runs between two players.
 */
public record PlayerRelationshipEdgeResponse(
        String id, String source, String target, String category, Integer sharedRuns) {

    public PlayerRelationshipEdgeResponse {
        id = normaliseId(id);
        source = normaliseId(source);
        target = normaliseId(target);
        category = normaliseCategory(category);
        sharedRuns = sharedRuns != null && sharedRuns >= 0 ? sharedRuns : 0;
    }

    private String normaliseId(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normaliseCategory(String value) {
        if (value == null) {
            return "weak";
        }
        String trimmed = value.strip();
        if (trimmed.isEmpty()) {
            return "weak";
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }
}
