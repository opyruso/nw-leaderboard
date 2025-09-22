package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

/**
 * Response payload describing a dungeon available for leaderboards.
 *
 * @param id            unique identifier of the dungeon
 * @param name          localized display name of the dungeon, selected using the request locale
 * @param names         map of all available localized names keyed by the two-letter language code
 * @param playerCount   number of players expected for the dungeon
 */
public record DungeonResponse(
        Long id,
        String name,
        Map<String, String> names,
        @JsonProperty("player_count") Integer playerCount) {}
