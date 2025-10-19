package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.CustomCharacterCreateRequest;
import com.opyruso.nwleaderboard.dto.CustomCharacterDeletionRequest;
import com.opyruso.nwleaderboard.dto.CustomCharacterLimitUpdateRequest;
import com.opyruso.nwleaderboard.dto.CustomCharacterOverviewResponse;
import com.opyruso.nwleaderboard.dto.CustomCharacterRenameRequest;
import com.opyruso.nwleaderboard.dto.CustomCharacterWeekResponse;
import com.opyruso.nwleaderboard.entity.CustomCharacter;
import com.opyruso.nwleaderboard.entity.CustomCharacterLimits;
import com.opyruso.nwleaderboard.service.CustomCharacterService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/**
 * REST resource exposing management operations for custom characters.
 */
@Path("/custom-characters")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CustomCharacterResource {

    private static final Logger LOG = Logger.getLogger(CustomCharacterResource.class);

    @Inject
    CustomCharacterService customCharacterService;

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @GET
    public Response listCharacters(
            @QueryParam("week") Integer week,
            @DefaultValue("false") @QueryParam("includeDeleted") boolean includeDeleted) {
        try {
            String userId = currentUserId();
            CustomCharacterOverviewResponse response =
                    customCharacterService.listCharacters(userId, week, includeDeleted);
            return Response.ok(response).build();
        } catch (IllegalStateException e) {
            LOG.error("Unable to determine current user while listing custom characters", e);
            return Response.status(Status.UNAUTHORIZED)
                    .entity(new ApiMessageResponse("Authentication required", null))
                    .build();
        } catch (IllegalArgumentException e) {
            LOG.debug("Invalid request while listing custom characters", e);
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to list custom characters", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to list characters", null))
                    .build();
        }
    }

    @POST
    public Response createCharacter(@Valid CustomCharacterCreateRequest request) {
        try {
            String userId = currentUserId();
            CustomCharacter character = customCharacterService.createCharacter(userId, request.name());
            CustomCharacterWeekResponse payload = new CustomCharacterWeekResponse(
                    character.getId(), character.getName(), character.isDeleted(), 0, 0, 0);
            return Response.status(Status.CREATED).entity(payload).build();
        } catch (IllegalStateException e) {
            LOG.error("Unable to determine current user while creating a custom character", e);
            return Response.status(Status.UNAUTHORIZED)
                    .entity(new ApiMessageResponse("Authentication required", null))
                    .build();
        } catch (IllegalArgumentException e) {
            LOG.debug("Invalid custom character creation request", e);
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to create custom character", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to create character", null))
                    .build();
        }
    }

    @PUT
    @Path("/{id}")
    public Response renameCharacter(@PathParam("id") Long id, @Valid CustomCharacterRenameRequest request) {
        try {
            String userId = currentUserId();
            return customCharacterService.renameCharacter(id, userId, request.name())
                    .map(updated -> Response.ok(new ApiMessageResponse("Character updated", null)).build())
                    .orElseGet(() -> Response.status(Status.NOT_FOUND)
                            .entity(new ApiMessageResponse("Character not found", null))
                            .build());
        } catch (IllegalStateException e) {
            LOG.error("Unable to determine current user while renaming a custom character", e);
            return Response.status(Status.UNAUTHORIZED)
                    .entity(new ApiMessageResponse("Authentication required", null))
                    .build();
        } catch (IllegalArgumentException e) {
            LOG.debug("Invalid rename request for custom character", e);
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse(e.getMessage(), null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to rename custom character", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update character", null))
                    .build();
        }
    }

    @PUT
    @Path("/{id}/limits/{week}")
    public Response updateLimits(
            @PathParam("id") Long id, @PathParam("week") Integer week, @Valid CustomCharacterLimitUpdateRequest request) {
        if (week == null) {
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse("Week parameter is required", null))
                    .build();
        }
        try {
            String userId = currentUserId();
            return customCharacterService
                    .updateWeeklyLimits(id, userId, week, request.weekUmbralsCap(), request.weekWinterLimit(),
                            request.weekHatcheryLimit())
                    .map(CustomCharacterResource::toResponse)
                    .orElseGet(() -> Response.status(Status.NOT_FOUND)
                            .entity(new ApiMessageResponse("Character not found", null))
                            .build());
        } catch (IllegalStateException e) {
            LOG.error("Unable to determine current user while updating custom character limits", e);
            return Response.status(Status.UNAUTHORIZED)
                    .entity(new ApiMessageResponse("Authentication required", null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to update custom character limits", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update character limits", null))
                    .build();
        }
    }

    @PUT
    @Path("/{id}/deletion")
    public Response updateDeletion(@PathParam("id") Long id, @Valid CustomCharacterDeletionRequest request) {
        try {
            String userId = currentUserId();
            return customCharacterService.updateDeletionStatus(id, userId, request.deleted())
                    .map(updated -> Response.ok(new ApiMessageResponse("Character updated", null)).build())
                    .orElseGet(() -> Response.status(Status.NOT_FOUND)
                            .entity(new ApiMessageResponse("Character not found", null))
                            .build());
        } catch (IllegalStateException e) {
            LOG.error("Unable to determine current user while updating custom character deletion state", e);
            return Response.status(Status.UNAUTHORIZED)
                    .entity(new ApiMessageResponse("Authentication required", null))
                    .build();
        } catch (Exception e) {
            LOG.error("Unable to update custom character deletion state", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update character", null))
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

    private static Response toResponse(CustomCharacterLimits limits) {
        int umbrals = limits.getWeekUmbralsCap() != null ? limits.getWeekUmbralsCap() : 0;
        int winter = limits.getWeekWinterLimit() != null ? limits.getWeekWinterLimit() : 0;
        int hatchery = limits.getWeekHatcheryLimit() != null ? limits.getWeekHatcheryLimit() : 0;
        CustomCharacter character = limits.getCustomCharacter();
        CustomCharacterWeekResponse payload = new CustomCharacterWeekResponse(
                character != null ? character.getId() : null,
                character != null ? character.getName() : null,
                character != null && character.isDeleted(),
                umbrals,
                winter,
                hatchery);
        return Response.ok(payload).build();
    }
}
