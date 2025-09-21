package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.ContributionExtractionResponseDto;
import com.opyruso.nwleaderboard.dto.ContributionRunDto;
import com.opyruso.nwleaderboard.service.ContributorExtractionService;
import com.opyruso.nwleaderboard.service.ContributorExtractionService.ContributorRequestException;
import com.opyruso.nwleaderboard.service.ContributorSubmissionService;
import com.opyruso.nwleaderboard.service.ContributorSubmissionService.ContributorSubmissionException;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
