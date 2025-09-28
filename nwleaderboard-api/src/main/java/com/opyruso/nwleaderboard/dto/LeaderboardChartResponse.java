package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record LeaderboardChartResponse(List<LeaderboardChartWeekResponse> weeks, Double globalAverage) {
    public LeaderboardChartResponse {
        weeks = weeks == null ? List.of() : List.copyOf(weeks);
    }
}
