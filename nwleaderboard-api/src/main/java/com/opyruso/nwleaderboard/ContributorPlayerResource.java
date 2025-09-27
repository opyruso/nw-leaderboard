package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.ContributorPlayerResponse;
import com.opyruso.nwleaderboard.dto.ContributorPlayerUpdateResponse;
import com.opyruso.nwleaderboard.dto.UpdatePlayerMainRequest;
import com.opyruso.nwleaderboard.dto.UpdatePlayerNameRequest;
import com.opyruso.nwleaderboard.dto.UpdatePlayerValidityRequest;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.service.ContributorPlayerService;
import com.opyruso.nwleaderboard.service.ContributorPlayerService.ContributorPlayerException;
import com.opyruso.nwleaderboard.service.ContributorPlayerService.PlayerWithRuns;
import com.opyruso.nwleaderboard.service.ContributorPlayerService.RenameResult;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Resource exposing contributor player management operations.
 */
@Path("/contributor/players")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ContributorPlayerResource {

    @Inject
    ContributorPlayerService playerService;

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @GET
    public Response listPlayers() {
        if (!hasContributorRole()) {
            return forbidden();
        }
        List<ContributorPlayerResponse> payload = playerService.listPlayers().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return Response.ok(payload).build();
    }

    @PUT
    @Path("/{playerId}/valid")
    public Response updateValidity(@PathParam("playerId") Long playerId, UpdatePlayerValidityRequest request) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        boolean valid = request != null && Boolean.TRUE.equals(request.valid());
        try {
            PlayerWithRuns updated = playerService.updateValidity(playerId, valid);
            ContributorPlayerResponse response = toResponse(updated);
            return Response.ok(new ContributorPlayerUpdateResponse(response, null)).build();
        } catch (ContributorPlayerException e) {
            return badRequest(e.getMessage());
        }
    }

    @PUT
    @Path("/{playerId}/main")
    public Response updateMain(@PathParam("playerId") Long playerId, UpdatePlayerMainRequest request) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        String desiredMain = request != null ? request.mainName() : null;
        try {
            PlayerWithRuns updated = playerService.updateMainCharacter(playerId, desiredMain);
            ContributorPlayerResponse response = toResponse(updated);
            return Response.ok(new ContributorPlayerUpdateResponse(response, null)).build();
        } catch (ContributorPlayerException e) {
            return badRequest(e.getMessage());
        }
    }

    @PUT
    @Path("/{playerId}")
    public Response updateName(@PathParam("playerId") Long playerId, UpdatePlayerNameRequest request) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        String desiredName = request != null ? request.playerName() : null;
        try {
            RenameResult result = playerService.renamePlayer(playerId, desiredName);
            ContributorPlayerResponse response = toResponse(result.player());
            return Response.ok(new ContributorPlayerUpdateResponse(response, result.removedPlayerId())).build();
        } catch (ContributorPlayerException e) {
            return badRequest(e.getMessage());
        }
    }

    private ContributorPlayerResponse toResponse(PlayerWithRuns summary) {
        if (summary == null || summary.player() == null) {
            return new ContributorPlayerResponse(null, null, false, 0L, 0L, 0L, null, null, 0L, null);
        }
        Player player = summary.player();
        long scoreRuns = summary.scoreRunCount();
        long timeRuns = summary.timeRunCount();
        long totalRuns = scoreRuns + timeRuns;
        Player main = resolveMain(player);
        Long mainId = main != null && !main.equals(player) ? main.getId() : null;
        String mainName = main != null && !main.equals(player) ? main.getPlayerName() : null;
        long alternateCount = summary.alternateCount();
        String regionId = player.getRegion() != null ? player.getRegion().getId() : null;
        return new ContributorPlayerResponse(
                player.getId(),
                player.getPlayerName(),
                player.isValid(),
                scoreRuns,
                timeRuns,
                totalRuns,
                mainId,
                mainName,
                alternateCount,
                regionId);
    }

    private Player resolveMain(Player player) {
        if (player == null) {
            return null;
        }
        Player current = player;
        int guard = 0;
        while (current.getMainCharacter() != null && guard < 10) {
            Player next = current.getMainCharacter();
            if (next == null || next.equals(current)) {
                break;
            }
            current = next;
            guard++;
        }
        return current;
    }

    private Response forbidden() {
        return Response.status(Status.FORBIDDEN)
                .entity(new ApiMessageResponse("Contributor role required", null))
                .build();
    }

    private Response badRequest(String message) {
        return Response.status(Status.BAD_REQUEST)
                .entity(new ApiMessageResponse(message != null ? message : "Invalid request", null))
                .build();
    }

    private boolean hasContributorRole() {
        if (identity != null && !identity.isAnonymous() && identity.getRoles().contains("contributor")) {
            return true;
        }
        if (jwt != null) {
            Set<String> groups = jwt.getGroups();
            if (groups != null && groups.stream().anyMatch(role -> "contributor".equalsIgnoreCase(role))) {
                return true;
            }
            Object resourceAccessClaim = jwt.getClaim("resource_access");
            if (resourceAccessClaim instanceof Map<?, ?> resourceAccess) {
                Object client = resourceAccess.get("nwleaderboard-app");
                if (client instanceof Map<?, ?> clientData) {
                    Object rolesObject = clientData.get("roles");
                    if (rolesObject instanceof Iterable<?> roles) {
                        for (Object role : roles) {
                            if (role != null && "contributor".equalsIgnoreCase(role.toString())) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }
}
