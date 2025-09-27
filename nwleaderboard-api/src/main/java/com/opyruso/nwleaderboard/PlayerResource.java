package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.LeaderboardPlayerResponse;
import com.opyruso.nwleaderboard.dto.PlayerProfileResponse;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.service.PlayerProfileService;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * REST resource exposing aggregated data for individual players.
 */
@Path("/player")
@Produces(MediaType.APPLICATION_JSON)
public class PlayerResource {

    @Inject
    PlayerProfileService playerProfileService;

    @Inject
    PlayerRepository playerRepository;

    @GET
    public Response searchPlayers(@QueryParam("q") String query, @QueryParam("limit") Integer limit) {
        if (query == null || query.trim().isEmpty()) {
            return Response.ok(List.of()).build();
        }

        int maxResults = limit != null && limit > 0 ? Math.min(limit, 20) : 10;
        List<Player> matches = new ArrayList<>(playerRepository.searchByName(query, maxResults));

        if (matches.isEmpty()) {
            try {
                Long playerId = Long.valueOf(query.trim());
                Player byId = playerRepository.findById(playerId);
                if (byId != null) {
                    matches.add(byId);
                }
            } catch (NumberFormatException ignored) {
                // best-effort: ignore invalid numeric input
            }
        }

        List<LeaderboardPlayerResponse> payload = matches.stream()
                .map(this::toLeaderboardPlayer)
                .collect(Collectors.toList());

        return Response.ok(payload).build();
    }

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

    private LeaderboardPlayerResponse toLeaderboardPlayer(Player player) {
        if (player == null) {
            return new LeaderboardPlayerResponse(null, null, null, null);
        }
        Player main = resolveMain(player);
        Long mainId = main != null && !main.equals(player) ? main.getId() : null;
        String mainName = main != null && !main.equals(player) ? main.getPlayerName() : null;
        return new LeaderboardPlayerResponse(player.getId(), player.getPlayerName(), mainId, mainName);
    }

    private Player resolveMain(Player player) {
        if (player == null) {
            return null;
        }
        Player current = player;
        java.util.Set<Long> visited = new java.util.HashSet<>();
        while (current.getMainCharacter() != null) {
            if (current.getId() != null && !visited.add(current.getId())) {
                break;
            }
            Player next = current.getMainCharacter();
            if (next == null || next.equals(current)) {
                break;
            }
            current = next;
        }
        return current;
    }
}

