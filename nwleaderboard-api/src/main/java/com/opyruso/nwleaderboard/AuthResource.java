package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.LoginRequest;
import com.opyruso.nwleaderboard.service.KeycloakAuthService;
import com.opyruso.nwleaderboard.service.KeycloakAuthService.LoginException;
import com.opyruso.nwleaderboard.service.KeycloakAuthService.LoginResult;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import org.jboss.logging.Logger;

@Path("/auth")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AuthResource {

    private static final Logger LOG = Logger.getLogger(AuthResource.class);

    @Inject
    KeycloakAuthService keycloakAuthService;

    @POST
    @Path("/login")
    public Response login(@Valid LoginRequest request) {
        try {
            LoginResult result = keycloakAuthService.login(request.username(), request.password());
            Response.ResponseBuilder builder = Response.status(result.status());
            if (result.body() != null) {
                builder.entity(result.body());
            } else if (result.status() == 200) {
                builder.entity(new ApiMessageResponse("Authentication successful", null));
            } else {
                builder.entity(new ApiMessageResponse("Authentication failed", null));
            }
            return builder.type(MediaType.APPLICATION_JSON).build();
        } catch (LoginException e) {
            LOG.error("Unable to authenticate with Keycloak", e);
            return Response.status(Status.BAD_GATEWAY)
                    .entity(new ApiMessageResponse("Authentication service unavailable", null))
                    .type(MediaType.APPLICATION_JSON)
                    .build();
        }
    }
}

