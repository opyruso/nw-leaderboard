package com.opyruso.nwleaderboard.dto;

/**
 * Response payload describing a dungeon available for leaderboards.
 *
 * @param id   unique identifier of the dungeon
 * @param name localized display name of the dungeon
 */
public record DungeonResponse(Long id, String name) {}
