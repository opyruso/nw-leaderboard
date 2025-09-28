package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.ContributorSeasonCreateRequest;
import com.opyruso.nwleaderboard.dto.ContributorSeasonEntryResponse;
import com.opyruso.nwleaderboard.dto.ContributorSeasonUpdateRequest;
import com.opyruso.nwleaderboard.service.ContributorSeasonService;
import com.opyruso.nwleaderboard.service.ContributorSeasonService.ContributorSeasonException;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/**
 * REST resource exposing contributor season management operations.
 */
@Path("/contributor/seasons")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ContributorSeasonResource {

    private static final Logger LOG = Logger.getLogger(ContributorSeasonResource.class);

    @Inject
    ContributorSeasonService seasonService;

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @GET
    public Response listSeasons() {
        if (!hasContributorRole()) {
            return forbidden();
        }
        try {
            return Response.ok(seasonService.listSeasons()).build();
        } catch (Exception e) {
            LOG.error("Unable to list seasons", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to load seasons", null))
                    .build();
        }
    }

    @POST
    public Response createSeason(ContributorSeasonCreateRequest request) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        try {
            ContributorSeasonEntryResponse created = seasonService.createSeason(request);
            return Response.status(Status.CREATED).entity(created).build();
        } catch (ContributorSeasonException e) {
            return Response.status(e.status())
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to create season", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to create season", null))
                    .build();
        }
    }

    @PUT
    @Path("/{seasonId}")
    public Response updateSeason(@PathParam("seasonId") Integer seasonId, ContributorSeasonUpdateRequest request) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        try {
            ContributorSeasonEntryResponse updated = seasonService.updateSeason(seasonId, request);
            return Response.ok(updated).build();
        } catch (ContributorSeasonException e) {
            return Response.status(e.status())
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to update season", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update season", null))
                    .build();
        }
    }

    @DELETE
    @Path("/{seasonId}")
    public Response deleteSeason(@PathParam("seasonId") Integer seasonId) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        try {
            seasonService.deleteSeason(seasonId);
            return Response.noContent().build();
        } catch (ContributorSeasonException e) {
            return Response.status(e.status())
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to delete season", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to delete season", null))
                    .build();
        }
    }

    private Response forbidden() {
        return Response.status(Status.FORBIDDEN)
                .entity(new ApiMessageResponse("Contributor role required", null))
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
