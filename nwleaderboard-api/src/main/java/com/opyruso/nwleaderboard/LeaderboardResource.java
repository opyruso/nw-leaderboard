package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.HighlightResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardEntryResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardPageResponse;
import com.opyruso.nwleaderboard.dto.IndividualRankingEntryResponse;
import com.opyruso.nwleaderboard.service.IndividualRankingService;
import com.opyruso.nwleaderboard.service.LeaderboardService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.util.List;

/**
 * REST resource exposing leaderboard entries grouped by dungeon and mode.
 */
@Path("/leaderboard")
@Produces(MediaType.APPLICATION_JSON)
public class LeaderboardResource {

    @Inject
    LeaderboardService leaderboardService;

    @Inject
    IndividualRankingService individualRankingService;

    @GET
    @Path("/score")
    public Response getScore(
            @QueryParam("dungeonId") Long dungeonId,
            @QueryParam("page") Integer page,
            @QueryParam("pageSize") Integer pageSize,
            @QueryParam("mutationType") List<String> mutationTypeIds,
            @QueryParam("mutationPromotion") List<String> mutationPromotionIds,
            @QueryParam("mutationCurse") List<String> mutationCurseIds) {
        if (dungeonId == null) {
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse("dungeonId query parameter is required", null))
                    .build();
        }
        LeaderboardPageResponse response = leaderboardService.getScoreEntries(
                dungeonId, page, pageSize, mutationTypeIds, mutationPromotionIds, mutationCurseIds);
        return Response.ok(response).build();
    }

    @GET
    @Path("/time")
    public Response getTime(
            @QueryParam("dungeonId") Long dungeonId,
            @QueryParam("page") Integer page,
            @QueryParam("pageSize") Integer pageSize,
            @QueryParam("mutationType") List<String> mutationTypeIds,
            @QueryParam("mutationPromotion") List<String> mutationPromotionIds,
            @QueryParam("mutationCurse") List<String> mutationCurseIds) {
        if (dungeonId == null) {
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse("dungeonId query parameter is required", null))
                    .build();
        }
        LeaderboardPageResponse response = leaderboardService.getTimeEntries(
                dungeonId, page, pageSize, mutationTypeIds, mutationPromotionIds, mutationCurseIds);
        return Response.ok(response).build();
    }

    @GET
    @Path("/highlights")
    public Response getHighlights() {
        List<HighlightResponse> highlights = leaderboardService.getHighlights();
        return Response.ok(highlights).build();
    }

    @GET
    @Path("/individual")
    public Response getIndividualRanking(@QueryParam("mode") String modeParam) {
        IndividualRankingService.Mode mode = IndividualRankingService.Mode.fromQuery(modeParam);
        List<IndividualRankingEntryResponse> entries = individualRankingService.getRanking(mode);
        return Response.ok(entries).build();
    }
}
