package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.SeasonResponse;
import com.opyruso.nwleaderboard.repository.SeasonRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.stream.Collectors;

/** Resource exposing public season information. */
@Path("/seasons")
@Produces(MediaType.APPLICATION_JSON)
public class SeasonResource {

    @Inject
    SeasonRepository seasonRepository;

    @GET
    public Response listSeasons() {
        List<SeasonResponse> seasons = seasonRepository.listAllOrderByDateBeginDesc().stream()
                .filter(season -> season != null && season.getId() != null)
                .map(season -> new SeasonResponse(season.getId(), season.getDateBegin(), season.getDateEnd()))
                .collect(Collectors.toList());
        return Response.ok(seasons).build();
    }
}

