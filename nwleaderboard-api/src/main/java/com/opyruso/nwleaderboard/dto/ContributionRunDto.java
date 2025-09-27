package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * DTO representing a run extracted from an uploaded screenshot.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributionRunDto(
        @JsonProperty("week") Integer week,
        @JsonProperty("dungeon") Long dungeonId,
        @JsonProperty("score") Integer score,
        @JsonProperty("time") Integer time,
        @JsonProperty("expected_player_count") Integer expectedPlayerCount,
        @JsonProperty("region") String region,
        @JsonProperty("players") List<ContributionPlayerDto> players) {
}
