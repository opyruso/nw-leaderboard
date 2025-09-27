package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Description of a suggestion sent back to clients.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SuggestionResponse(
        @JsonProperty("id") Long id,
        @JsonProperty("author") String author,
        @JsonProperty("title") String title,
        @JsonProperty("content") String content,
        @JsonProperty("status") String status,
        @JsonProperty("created_at") String createdAt) {
}
