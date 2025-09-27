package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.SuggestionRequest;
import com.opyruso.nwleaderboard.dto.SuggestionResponse;
import com.opyruso.nwleaderboard.dto.SuggestionStatusUpdateRequest;
import com.opyruso.nwleaderboard.entity.Suggestion;
import com.opyruso.nwleaderboard.entity.SuggestionStatus;
import com.opyruso.nwleaderboard.service.SuggestionService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/**
 * REST resource exposing CRUD operations for user suggestions.
 */
@Path("/suggestions")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SuggestionResource {

    private static final Logger LOG = Logger.getLogger(SuggestionResource.class);

    @Inject
    SuggestionService suggestionService;

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @POST
    public Response createSuggestion(@Valid SuggestionRequest request) {
        try {
            String author = currentUserId();
            String title = request.title().trim();
            String content = request.content().trim();
            Suggestion suggestion = suggestionService.createSuggestion(author, title, content);
            SuggestionResponse response = toResponse(suggestion, false, true);
            return Response.status(Status.CREATED).entity(response).build();
        } catch (IllegalStateException e) {
            LOG.error("Unable to identify current user for suggestion creation", e);
            return Response.status(Status.UNAUTHORIZED)
                    .entity(new ApiMessageResponse("Authentication required", null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to store user suggestion", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to store suggestion", null))
                    .build();
        }
    }

    @GET
    @Path("/mine")
    public Response listCurrentUserSuggestions() {
        try {
            String author = currentUserId();
            List<SuggestionResponse> suggestions = suggestionService.listForAuthor(author).stream()
                    .map(entity -> toResponse(entity, false, false))
                    .collect(Collectors.toList());
            return Response.ok(suggestions).build();
        } catch (IllegalStateException e) {
            LOG.error("Unable to identify current user while listing suggestions", e);
            return Response.status(Status.UNAUTHORIZED)
                    .entity(new ApiMessageResponse("Authentication required", null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to list user suggestions", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to list suggestions", null))
                    .build();
        }
    }

    @GET
    @Path("/admin")
    public Response listAllSuggestions() {
        if (!hasAdminRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Admin role required", null))
                    .build();
        }
        try {
            List<SuggestionResponse> suggestions = suggestionService.listAll().stream()
                    .map(entity -> toResponse(entity, true, true))
                    .collect(Collectors.toList());
            return Response.ok(suggestions).build();
        } catch (Exception e) {
            LOG.error("Unable to list suggestions", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to list suggestions", null))
                    .build();
        }
    }

    @PUT
    @Path("/{id}/status")
    public Response updateStatus(@PathParam("id") Long id, @Valid SuggestionStatusUpdateRequest request) {
        if (!hasAdminRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Admin role required", null))
                    .build();
        }
        SuggestionStatus status = SuggestionStatus.fromString(request.status());
        if (status == null) {
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse("Unknown status", null))
                    .build();
        }
        try {
            return suggestionService.updateStatus(id, status)
                    .map(entity -> Response.ok(toResponse(entity, true, true)).build())
                    .orElseGet(() -> Response.status(Status.NOT_FOUND)
                            .entity(new ApiMessageResponse("Suggestion not found", null))
                            .build());
        } catch (Exception e) {
            LOG.error("Unable to update suggestion status", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update suggestion status", null))
                    .build();
        }
    }

    private String currentUserId() {
        if (jwt != null && jwt.getSubject() != null && !jwt.getSubject().isBlank()) {
            return jwt.getSubject();
        }
        if (identity != null && identity.getPrincipal() != null) {
            String name = identity.getPrincipal().getName();
            if (name != null && !name.isBlank()) {
                return name;
            }
        }
        throw new IllegalStateException("Unable to identify current user");
    }

    private boolean hasAdminRole() {
        if (identity != null && !identity.isAnonymous() && identity.getRoles().contains("admin")) {
            return true;
        }
        if (jwt != null) {
            Set<String> groups = jwt.getGroups();
            if (groups != null && groups.stream().anyMatch(role -> "admin".equalsIgnoreCase(role))) {
                return true;
            }
            Object resourceAccessClaim = jwt.getClaim("resource_access");
            if (resourceAccessClaim instanceof Map<?, ?> resourceAccess) {
                Object client = resourceAccess.get("nwleaderboard-app");
                if (client instanceof Map<?, ?> clientData) {
                    Object rolesObject = clientData.get("roles");
                    if (rolesObject instanceof Iterable<?> roles) {
                        for (Object role : roles) {
                            if (role != null && "admin".equalsIgnoreCase(role.toString())) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    private SuggestionResponse toResponse(Suggestion entity, boolean includeAuthor, boolean includeContent) {
        if (entity == null) {
            return null;
        }
        String author = includeAuthor ? entity.getAuthor() : null;
        String content = includeContent ? entity.getContent() : null;
        String createdAt = formatDate(entity.getCreationDate());
        return new SuggestionResponse(entity.getId(), author, entity.getTitle(), content,
                entity.getStatus() != null ? entity.getStatus().name() : null, createdAt);
    }

    private String formatDate(LocalDateTime dateTime) {
        return dateTime != null ? dateTime.toString() : null;
    }
}
