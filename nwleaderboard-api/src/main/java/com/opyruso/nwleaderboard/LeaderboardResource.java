package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardEntryResponse;
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

    @GET
    @Path("/score")
    public Response getScore(@QueryParam("dungeonId") Long dungeonId, @QueryParam("limit") Integer limit) {
        if (dungeonId == null) {
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse("dungeonId query parameter is required", null))
                    .build();
        }
        List<LeaderboardEntryResponse> entries = leaderboardService.getScoreEntries(dungeonId, limit);
        return Response.ok(entries).build();
    }

    @GET
    @Path("/time")
    public Response getTime(@QueryParam("dungeonId") Long dungeonId, @QueryParam("limit") Integer limit) {
        if (dungeonId == null) {
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse("dungeonId query parameter is required", null))
                    .build();
        }
        List<LeaderboardEntryResponse> entries = leaderboardService.getTimeEntries(dungeonId, limit);
        return Response.ok(entries).build();
    }
}
