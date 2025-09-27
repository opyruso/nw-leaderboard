package com.opyruso.nwleaderboard.entity;

/**
 * Possible statuses for a user suggestion.
 */
public enum SuggestionStatus {
    NEW,
    IN_PROGRESS,
    PUT_ON_TODO_LIST,
    REFUSED,
    FIXED;

    public static SuggestionStatus fromString(String value) {
        if (value == null) {
            return null;
        }
        for (SuggestionStatus status : values()) {
            if (status.name().equalsIgnoreCase(value.trim())) {
                return status;
            }
        }
        return null;
    }
}
