package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ScoreLeaderboardEntryResponse;
import com.opyruso.nwleaderboard.dto.TimeLeaderboardEntryResponse;
import com.opyruso.nwleaderboard.service.LeaderboardService;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

/**
 * REST resource exposing leaderboard data for score and time views.
 */
@Path("/leaderboard")
@Produces(MediaType.APPLICATION_JSON)
public class LeaderboardResource {

    @Inject
    LeaderboardService leaderboardService;

    @GET
    @Path("/score")
    public List<ScoreLeaderboardEntryResponse> score(@QueryParam("dungeonId") Long dungeonId) {
        long id = requireDungeonId(dungeonId);
        return leaderboardService.getScoreLeaderboard(id);
    }

    @GET
    @Path("/time")
    public List<TimeLeaderboardEntryResponse> time(@QueryParam("dungeonId") Long dungeonId) {
        long id = requireDungeonId(dungeonId);
        return leaderboardService.getTimeLeaderboard(id);
    }

    private long requireDungeonId(Long dungeonId) {
        if (dungeonId == null) {
            throw new BadRequestException("Query parameter 'dungeonId' is required");
        }
        if (dungeonId.longValue() <= 0) {
            throw new BadRequestException("Query parameter 'dungeonId' must be greater than zero");
        }
        return dungeonId;
    }
}
