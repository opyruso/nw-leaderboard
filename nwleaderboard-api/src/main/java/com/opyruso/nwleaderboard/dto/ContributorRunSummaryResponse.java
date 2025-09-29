package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Response payload describing a contributor run search result.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ContributorRunSummaryResponse(
        Long id,
        String mode,
        @JsonProperty("dungeon_id") Long dungeonId,
        @JsonProperty("dungeon_name") String dungeonName,
        @JsonProperty("region") String regionId,
        Integer week,
        @JsonProperty("season_id") Integer seasonId,
        Integer score,
        @JsonProperty("time") Integer timeInSeconds,
        List<ContributorRunPlayerResponse> players) {}
