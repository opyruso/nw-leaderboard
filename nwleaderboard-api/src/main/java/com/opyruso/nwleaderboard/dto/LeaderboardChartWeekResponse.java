package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record LeaderboardChartWeekResponse(
        Integer week,
        Double bestValue,
        Double worstValue,
        Long runCount) {}
