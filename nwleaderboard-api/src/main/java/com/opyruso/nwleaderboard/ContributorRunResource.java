package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.ContributorRunSummaryResponse;
import com.opyruso.nwleaderboard.dto.ContributorRunUpdateRequest;
import com.opyruso.nwleaderboard.dto.ContributorWeeklyRunsResponse;
import com.opyruso.nwleaderboard.service.ContributorRunService;
import com.opyruso.nwleaderboard.service.ContributorRunService.ContributorRunException;
import com.opyruso.nwleaderboard.service.ContributorStatisticsService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/** REST resource exposing contributor run management operations. */
@Path("/contributor/runs")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ContributorRunResource {

    private static final Logger LOG = Logger.getLogger(ContributorRunResource.class);

    @Inject
    ContributorRunService runService;

    @Inject
    ContributorStatisticsService statisticsService;

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @GET
    public Response searchRuns(
            @QueryParam("type") String type,
            @QueryParam("region") String region,
            @QueryParam("season") Integer season,
            @QueryParam("week") Integer week,
            @QueryParam("score") Integer score,
            @QueryParam("time") Integer time,
            @QueryParam("player") List<String> players,
            @QueryParam("limit") Integer limit) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        try {
            List<ContributorRunSummaryResponse> runs =
                    runService.searchRuns(type, region, season, week, score, time, players, limit);
            return Response.ok(runs).build();
        } catch (ContributorRunException e) {
            return handleContributorError(e);
        } catch (Exception e) {
            LOG.error("Unable to search runs", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to search runs", null))
                    .build();
        }
    }

    @GET
    @Path("/weekly")
    public Response listRunsByWeek() {
        if (!hasContributorRole()) {
            return forbidden();
        }
        try {
            List<ContributorWeeklyRunsResponse> summaries = statisticsService.listRunsByWeek();
            return Response.ok(summaries).build();
        } catch (Exception e) {
            LOG.error("Unable to load contributor run statistics", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to load run statistics", null))
                    .build();
        }
    }

    @PUT
    @Path("/{type}/{runId}")
    public Response updateRun(
            @PathParam("type") String type,
            @PathParam("runId") Long runId,
            ContributorRunUpdateRequest request) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        try {
            ContributorRunSummaryResponse updated = runService.updateRun(type, runId, request);
            return Response.ok(updated).build();
        } catch (ContributorRunException e) {
            return handleContributorError(e);
        } catch (Exception e) {
            LOG.errorf(e, "Unable to update %s run %s", type, runId);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update run", null))
                    .build();
        }
    }

    @DELETE
    @Path("/{type}/{runId}")
    public Response deleteRun(@PathParam("type") String type, @PathParam("runId") Long runId) {
        if (!hasContributorRole()) {
            return forbidden();
        }
        try {
            runService.deleteRun(type, runId);
            return Response.noContent().build();
        } catch (ContributorRunException e) {
            return handleContributorError(e);
        } catch (Exception e) {
            LOG.errorf(e, "Unable to delete %s run %s", type, runId);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to delete run", null))
                    .build();
        }
    }

    private Response forbidden() {
        return Response.status(Status.FORBIDDEN)
                .entity(new ApiMessageResponse("Contributor role required", null))
                .build();
    }

    private Response handleContributorError(ContributorRunException exception) {
        Status status = exception.getStatus() != null ? exception.getStatus() : Status.BAD_REQUEST;
        return Response.status(status)
                .entity(new ApiMessageResponse(exception.getMessage(), null))
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
