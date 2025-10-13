package com.opyruso.nwleaderboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Description of an announcement exposed to clients.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AnnouncementResponse(
        @JsonProperty("id") Long id,
        @JsonProperty("title") String title,
        @JsonProperty("content_en") String contentEn,
        @JsonProperty("content_de") String contentDe,
        @JsonProperty("content_fr") String contentFr,
        @JsonProperty("content_es") String contentEs,
        @JsonProperty("content_esmx") String contentEsmx,
        @JsonProperty("content_it") String contentIt,
        @JsonProperty("content_pl") String contentPl,
        @JsonProperty("content_pt") String contentPt,
        @JsonProperty("start_date") String startDate,
        @JsonProperty("end_date") String endDate) {
}
