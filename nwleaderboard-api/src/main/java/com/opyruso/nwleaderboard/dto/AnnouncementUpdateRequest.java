package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Payload used to update an existing announcement.
 */
public record AnnouncementUpdateRequest(
        @NotBlank @JsonProperty("title") String title,
        @NotBlank @JsonProperty("content_en") String contentEn,
        @NotBlank @JsonProperty("content_de") String contentDe,
        @NotBlank @JsonProperty("content_fr") String contentFr,
        @NotBlank @JsonProperty("content_es") String contentEs,
        @NotBlank @JsonProperty("content_esmx") String contentEsmx,
        @NotBlank @JsonProperty("content_it") String contentIt,
        @NotBlank @JsonProperty("content_pl") String contentPl,
        @NotBlank @JsonProperty("content_pt") String contentPt,
        @NotNull @JsonProperty("start_date") String startDate,
        @NotNull @JsonProperty("end_date") String endDate) {
}
