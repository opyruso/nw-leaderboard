package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Response payload describing a paginated set of leaderboard entries.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LeaderboardPageResponse(
        List<LeaderboardEntryResponse> entries,
        long totalEntries,
        int page,
        int pageSize,
        int totalPages) {

    public LeaderboardPageResponse {
        entries = entries == null ? List.of() : List.copyOf(entries);
        if (page < 1) {
            page = 1;
        }
        if (pageSize < 1) {
            pageSize = 1;
        }
        if (totalPages < 1) {
            totalPages = 1;
        }
    }
}

