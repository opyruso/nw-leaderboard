package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.PlayerProfileResponse;
import com.opyruso.nwleaderboard.service.PlayerProfileService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.util.Optional;

/**
 * REST resource exposing aggregated data for individual players.
 */
@Path("/player")
@Produces(MediaType.APPLICATION_JSON)
public class PlayerResource {

    @Inject
    PlayerProfileService playerProfileService;

    @GET
    @Path("/{playerId}")
    public Response getProfile(@PathParam("playerId") Long playerId) {
        Optional<PlayerProfileResponse> profile = playerProfileService.getProfile(playerId);
        if (profile.isEmpty()) {
            return Response.status(Status.NOT_FOUND)
                    .entity(new ApiMessageResponse("player not found", null))
                    .build();
        }
        return Response.ok(profile.get()).build();
    }
}

