package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.ApiMessageResponse;
import com.opyruso.nwleaderboard.dto.ChangePasswordRequest;
import com.opyruso.nwleaderboard.dto.RegisterRequest;
import com.opyruso.nwleaderboard.dto.ResetPasswordRequest;
import com.opyruso.nwleaderboard.service.KeycloakAdminService;
import com.opyruso.nwleaderboard.service.KeycloakAdminService.RegisterException;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;

@Path("/user")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class UserResource {

    @Inject
    KeycloakAdminService keycloakAdminService;

    @POST
    @Path("/register")
    public Response register(@Valid RegisterRequest request) {
        try {
            keycloakAdminService.register(request.username(), request.email(), request.password());
            return Response.status(Status.CREATED)
                    .entity(new ApiMessageResponse("User registered successfully", null))
                    .build();
        } catch (RegisterException e) {
            return mapRegisterException(e);
        }
    }

    @POST
    @Path("/reset-password")
    public Response resetPassword(@Valid ResetPasswordRequest request) {
        keycloakAdminService.sendResetPassword(request.email());
        return Response.status(Status.ACCEPTED)
                .entity(new ApiMessageResponse("If an account matches this email, a reset message has been sent", null))
                .build();
    }

    @POST
    @Path("/password")
    public Response changePassword(@Context HttpHeaders headers, @Valid ChangePasswordRequest request) {
        String token = extractBearer(headers);
        if (token == null) {
            return Response.status(Status.UNAUTHORIZED)
                    .entity(new ApiMessageResponse("Authentication required", null))
                    .build();
        }

        int status = keycloakAdminService.changePassword(token, request);
        if (status == Status.NO_CONTENT.getStatusCode()) {
            return Response.status(Status.NO_CONTENT).build();
        }

        Status mappedStatus;
        String message;
        if (status == Status.UNAUTHORIZED.getStatusCode()) {
            mappedStatus = Status.UNAUTHORIZED;
            message = "Current password is incorrect";
        } else if (status == Status.BAD_REQUEST.getStatusCode()) {
            mappedStatus = Status.BAD_REQUEST;
            message = "Unable to verify the user information";
        } else if (status == Status.BAD_GATEWAY.getStatusCode()) {
            mappedStatus = Status.BAD_GATEWAY;
            message = "Authentication service unavailable";
        } else {
            mappedStatus = Status.BAD_GATEWAY;
            message = "Unable to change password";
        }

        return Response.status(mappedStatus)
                .entity(new ApiMessageResponse(message, null))
                .build();
    }

    private Response mapRegisterException(RegisterException exception) {
        int code = exception.getCode();
        Status status;
        String message;
        switch (code) {
            case 10 -> {
                status = Status.BAD_REQUEST;
                message = "Username is required";
            }
            case 20 -> {
                status = Status.BAD_REQUEST;
                message = "Email is required";
            }
            case 30 -> {
                status = Status.BAD_REQUEST;
                message = "Password is required";
            }
            case 11 -> {
                status = Status.CONFLICT;
                message = "Username already exists";
            }
            case 21 -> {
                status = Status.CONFLICT;
                message = "Email already exists";
            }
            default -> {
                status = Status.BAD_GATEWAY;
                message = "Unable to register user";
            }
        }
        return Response.status(status)
                .entity(new ApiMessageResponse(message, code))
                .build();
    }

    private String extractBearer(HttpHeaders headers) {
        if (headers == null) {
            return null;
        }
        String value = headers.getHeaderString(HttpHeaders.AUTHORIZATION);
        if (value == null || value.isBlank()) {
            return null;
        }
        if (!value.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        String token = value.substring(7).trim();
        return token.isEmpty() ? null : token;
    }
}
