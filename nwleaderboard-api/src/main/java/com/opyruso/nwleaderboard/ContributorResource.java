package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.ContributionExtractionResponseDto;
import com.opyruso.nwleaderboard.dto.ContributionRunDto;
import com.opyruso.nwleaderboard.dto.ContributionScanDetailDto;
import com.opyruso.nwleaderboard.dto.ContributionScanSummaryDto;
import com.opyruso.nwleaderboard.dto.UpdateContributionScanRequest;
import com.opyruso.nwleaderboard.dto.UpdateDungeonHighlightsRequest;
import com.opyruso.nwleaderboard.dto.RegionResponse;
import com.opyruso.nwleaderboard.dto.RescanContributionScanRequest;
import com.opyruso.nwleaderboard.service.ContributorExtractionService;
import com.opyruso.nwleaderboard.service.ContributorExtractionService.ContributorRequestException;
import com.opyruso.nwleaderboard.service.ContributorSubmissionService;
import com.opyruso.nwleaderboard.service.ContributorSubmissionService.ContributorSubmissionException;
import com.opyruso.nwleaderboard.service.DungeonService;
import com.opyruso.nwleaderboard.service.RegionService;
import com.opyruso.nwleaderboard.service.ScanLeaderboardService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;
import org.jboss.resteasy.plugins.providers.multipart.MultipartFormDataInput;

/**
 * Resource exposing contributor-specific features such as OCR extraction and leaderboard data submission.
 */
@Path("/contributor")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class ContributorResource {

    private static final Logger LOG = Logger.getLogger(ContributorResource.class);

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @Inject
    ContributorExtractionService extractionService;

    @Inject
    ContributorSubmissionService submissionService;

    @Inject
    DungeonService dungeonService;
    
    @Inject
    ScanLeaderboardService scanLeaderboardService;

    @Inject
    RegionService regionService;

    @POST
    @Path("/extract")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response extract(MultipartFormDataInput input) {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }

        try {
            ContributionExtractionResponseDto extraction = extractionService.extract(input);
            return Response.ok(extraction).build();
        } catch (ContributorRequestException e) {
            LOG.debug("Unable to extract contributor data", e);
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unexpected error during OCR extraction", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to process images", null))
                    .build();
        }
    }

    @POST
    @Path("/submit")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response submit(@Valid List<ContributionRunDto> payload) {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }

        try {
            submissionService.persistRuns(payload);
            return Response.status(Status.CREATED)
                    .entity(new ApiMessageResponse("Runs stored successfully", null))
                    .build();
        } catch (ContributorSubmissionException e) {
            LOG.debug("Unable to store contributor data", e);
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unexpected error while storing contributor data", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to store contributor data", null))
                    .build();
        }
    }

    @PUT
    @Path("/dungeons/highlights")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response updateDungeonHighlights(UpdateDungeonHighlightsRequest request) {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }
        try {
            List<Long> dungeonIds = request != null ? request.highlightedIds() : List.of();
            dungeonService.updateHighlightedDungeons(dungeonIds);
            return Response.ok(new ApiMessageResponse("Highlights updated", null)).build();
        } catch (Exception e) {
            LOG.error("Unable to update highlighted dungeons", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update dungeon highlights", null))
                    .build();
        }
    }

    @GET
    @Path("/regions")
    public Response listRegions() {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }
        try {
            List<RegionResponse> regions = regionService.listRegions().stream()
                    .map(region -> new RegionResponse(region.getId()))
                    .collect(Collectors.toList());
            return Response.ok(regions).build();
        } catch (Exception e) {
            LOG.error("Unable to list supported regions", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to list regions", null))
                    .build();
        }
    }

    @GET
    @Path("/scans")
    public Response listPendingScans() {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }
        try {
            List<ContributionScanSummaryDto> scans = scanLeaderboardService.listScans();
            return Response.ok(scans).build();
        } catch (Exception e) {
            LOG.error("Unable to list stored leaderboard scans", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to list stored scans", null))
                    .build();
        }
    }

    @GET
    @Path("/scans/{id}")
    public Response getScanDetail(@PathParam("id") Long id) {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }
        try {
            ContributionScanDetailDto detail = scanLeaderboardService.getScanDetail(id);
            if (detail == null) {
                return Response.status(Status.NOT_FOUND)
                        .entity(new ApiMessageResponse("Scan not found", null))
                        .build();
            }
            return Response.ok(detail).build();
        } catch (Exception e) {
            LOG.error("Unable to load stored leaderboard scan", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to load stored scan", null))
                    .build();
        }
    }

    @POST
    @Path("/scans/{id}/rescan")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response rescanStoredScan(@PathParam("id") Long id, RescanContributionScanRequest request) {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }
        try {
            ContributionScanDetailDto detail = extractionService.rescanStoredScan(id,
                    request != null ? request.offset() : null,
                    request != null ? request.offsets() : null,
                    request != null ? request.region() : null);
            if (detail == null) {
                return Response.status(Status.NOT_FOUND)
                        .entity(new ApiMessageResponse("Scan not found", null))
                        .build();
            }
            return Response.ok(detail).build();
        } catch (ContributorRequestException e) {
            LOG.debug("Unable to reprocess stored leaderboard scan", e);
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unexpected error while reprocessing stored leaderboard scan", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to reprocess stored scan", null))
                    .build();
        }
    }

    @DELETE
    @Path("/scans/{id}")
    public Response deleteScan(@PathParam("id") Long id) {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }
        try {
            scanLeaderboardService.deleteScan(id);
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.error("Unable to delete stored leaderboard scan", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to delete stored scan", null))
                    .build();
        }
    }

    @PUT
    @Path("/scans/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response updateScan(@PathParam("id") Long id, UpdateContributionScanRequest request) {
        if (!hasContributorRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Contributor role required", null))
                    .build();
        }
        try {
            ContributionScanDetailDto updated = scanLeaderboardService.updateScan(id,
                    request != null ? request.week() : null,
                    request != null ? request.dungeonId() : null,
                    request != null ? request.leaderboardType() : null,
                    request != null ? request.region() : null,
                    request != null ? request.extraction() : null);
            if (updated == null) {
                return Response.status(Status.NOT_FOUND)
                        .entity(new ApiMessageResponse("Scan not found", null))
                        .build();
            }
            return Response.ok(updated).build();
        } catch (Exception e) {
            LOG.error("Unable to update stored leaderboard scan", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update stored scan", null))
                    .build();
        }
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
