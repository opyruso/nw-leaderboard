package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.AnnouncementResponse;
import com.opyruso.nwleaderboard.dto.AnnouncementUpdateRequest;
import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.entity.Announcement;
import com.opyruso.nwleaderboard.service.AnnouncementService;
import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/**
 * REST resource exposing announcement management endpoints.
 */
@Path("/announcements")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AnnouncementResource {

    private static final Logger LOG = Logger.getLogger(AnnouncementResource.class);

    @Inject
    AnnouncementService announcementService;

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @GET
    public Response listActiveAnnouncements() {
        try {
            List<AnnouncementResponse> responses = announcementService.listActiveAnnouncements().stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
            return Response.ok(responses).build();
        } catch (Exception e) {
            LOG.error("Unable to list active announcements", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to list announcements", null))
                    .build();
        }
    }

    @GET
    @Path("/admin")
    @Authenticated
    public Response listAllAnnouncements() {
        if (!hasAdminRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Admin role required", null))
                    .build();
        }
        try {
            List<AnnouncementResponse> responses = announcementService.listAllAnnouncements().stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
            return Response.ok(responses).build();
        } catch (Exception e) {
            LOG.error("Unable to list announcements", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to list announcements", null))
                    .build();
        }
    }

    @POST
    @Authenticated
    public Response createAnnouncement() {
        if (!hasAdminRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Admin role required", null))
                    .build();
        }
        try {
            Announcement announcement = announcementService.createDefaultAnnouncement();
            return Response.status(Status.CREATED).entity(toResponse(announcement)).build();
        } catch (Exception e) {
            LOG.error("Unable to create announcement", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to create announcement", null))
                    .build();
        }
    }

    @PUT
    @Path("/{id}")
    @Authenticated
    public Response updateAnnouncement(@PathParam("id") Long id, @Valid AnnouncementUpdateRequest request) {
        if (!hasAdminRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Admin role required", null))
                    .build();
        }
        Optional<Announcement> values = buildAnnouncementFromRequest(request);
        if (values.isEmpty()) {
            return Response.status(Status.BAD_REQUEST)
                    .entity(new ApiMessageResponse("Invalid announcement payload", null))
                    .build();
        }
        Optional<Announcement> updated;
        try {
            updated = announcementService.updateAnnouncement(id, values.get());
        } catch (Exception e) {
            LOG.errorf(e, "Unable to update announcement %s", id);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to update announcement", null))
                    .build();
        }
        if (updated.isEmpty()) {
            return Response.status(Status.NOT_FOUND)
                    .entity(new ApiMessageResponse("Announcement not found", null))
                    .build();
        }
        return Response.ok(toResponse(updated.get())).build();
    }

    @DELETE
    @Path("/{id}")
    @Authenticated
    public Response deleteAnnouncement(@PathParam("id") Long id) {
        if (!hasAdminRole()) {
            return Response.status(Status.FORBIDDEN)
                    .entity(new ApiMessageResponse("Admin role required", null))
                    .build();
        }
        try {
            boolean deleted = announcementService.deleteAnnouncement(id);
            if (!deleted) {
                return Response.status(Status.NOT_FOUND)
                        .entity(new ApiMessageResponse("Announcement not found", null))
                        .build();
            }
            return Response.noContent().build();
        } catch (Exception e) {
            LOG.errorf(e, "Unable to delete announcement %s", id);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Unable to delete announcement", null))
                    .build();
        }
    }

    private Optional<Announcement> buildAnnouncementFromRequest(AnnouncementUpdateRequest request) {
        if (request == null) {
            return Optional.empty();
        }
        try {
            Announcement announcement = new Announcement();
            announcement.setTitle(request.title().trim());
            announcement.setContentEn(request.contentEn().trim());
            announcement.setContentDe(request.contentDe().trim());
            announcement.setContentFr(request.contentFr().trim());
            announcement.setContentEs(request.contentEs().trim());
            announcement.setContentEsmx(request.contentEsmx().trim());
            announcement.setContentIt(request.contentIt().trim());
            announcement.setContentPl(request.contentPl().trim());
            announcement.setContentPt(request.contentPt().trim());
            LocalDateTime start = parseDate(request.startDate());
            LocalDateTime end = parseDate(request.endDate());
            if (start == null || end == null) {
                return Optional.empty();
            }
            if (end.isBefore(start)) {
                return Optional.empty();
            }
            announcement.setStartDate(start);
            announcement.setEndDate(end);
            return Optional.of(announcement);
        } catch (Exception e) {
            LOG.error("Invalid announcement update payload", e);
            return Optional.empty();
        }
    }

    private LocalDateTime parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e) {
            LOG.warnf(e, "Unable to parse announcement date: %s", value);
            return null;
        }
    }

    private AnnouncementResponse toResponse(Announcement entity) {
        if (entity == null) {
            return null;
        }
        return new AnnouncementResponse(entity.getId(), entity.getTitle(), entity.getContentEn(),
                entity.getContentDe(), entity.getContentFr(), entity.getContentEs(), entity.getContentEsmx(),
                entity.getContentIt(), entity.getContentPl(), entity.getContentPt(), formatDate(entity.getStartDate()),
                formatDate(entity.getEndDate()));
    }

    private String formatDate(LocalDateTime dateTime) {
        return dateTime != null ? dateTime.toString() : null;
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
}
