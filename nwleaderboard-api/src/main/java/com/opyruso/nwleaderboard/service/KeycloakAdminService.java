package com.opyruso.nwleaderboard.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opyruso.nwleaderboard.dto.ChangePasswordRequest;
import jakarta.inject.Inject;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.ext.ContextResolver;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;
import org.keycloak.OAuth2Constants;
import org.keycloak.TokenVerifier;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.AccessToken;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.UserRepresentation;

import java.util.List;

/**
 * Service utilitaire pour l'administration de Keycloak.
 */
@ApplicationScoped
public class KeycloakAdminService {

    @ConfigProperty(name = "auth.admin.url")
    String serverUrl;

    @ConfigProperty(name = "auth.admin.realm")
    String realm;

    @ConfigProperty(name = "auth.admin.client-id")
    String clientId;

    @ConfigProperty(name = "auth.admin.client-secret")
    String clientSecret;

    @ConfigProperty(name = "auth.admin.redirect-uri")
    String redirectUri;

    Keycloak keycloak;

    private static final Logger LOG = Logger.getLogger(KeycloakAdminService.class);

    @Inject
    KeycloakAuthService keycloakAuthService;

    @PostConstruct
    void init() {
        Client client = ClientBuilder.newBuilder()
                .register(new KeycloakObjectMapperContextResolver())
                .build();

        keycloak = KeycloakBuilder.builder()
                .serverUrl(serverUrl)
                .realm(realm)
                .grantType(OAuth2Constants.CLIENT_CREDENTIALS)
                .clientId(clientId)
                .clientSecret(clientSecret)
                .resteasyClient(client)
                .build();
    }

    static final class KeycloakObjectMapperContextResolver implements ContextResolver<ObjectMapper> {
        private final ObjectMapper mapper;

        KeycloakObjectMapperContextResolver() {
            mapper = new ObjectMapper();
            mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        }

        @Override
        public ObjectMapper getContext(Class<?> type) {
            return mapper;
        }
    }

    public void register(String username, String email, String password) throws RegisterException {
        if (username == null || username.isBlank()) {
            LOG.warn("Username is blank");
            throw new RegisterException(10);
        }
        if (email == null || email.isBlank()) {
            LOG.warn("Email is blank");
            throw new RegisterException(20);
        }
        if (password == null || password.isBlank()) {
            LOG.warn("Password is blank");
            throw new RegisterException(30);
        }

        UsersResource users = keycloak.realm(realm).users();
        if (!users.searchByUsername(username, true).isEmpty()) {
            LOG.warnf("Username %s already exists", username);
            throw new RegisterException(11);
        }
        if (!users.searchByEmail(email, true).isEmpty()) {
            LOG.warnf("Email %s already exists", email);
            throw new RegisterException(21);
        }

        UserRepresentation user = new UserRepresentation();
        user.setUsername(username);
        user.setEmail(email);
        user.setFirstName(username);
        user.setLastName(username);
        user.setEnabled(true);

        CredentialRepresentation cred = new CredentialRepresentation();
        cred.setType(CredentialRepresentation.PASSWORD);
        cred.setTemporary(false);
        cred.setValue(password);
        user.setCredentials(List.of(cred));

        LOG.debugf("Creating Keycloak user %s", username);
        var response = users.create(user);
        try {
            if (response.getStatus() != 201) {
                LOG.errorf("Failed to create user %s, status %d", username, response.getStatus());
                throw new RegisterException(31);
            }
        } finally {
            response.close();
        }
    }

    public void sendResetPassword(String email) {
        if (email == null || email.isBlank()) {
            LOG.warn("Email is blank; cannot send reset password");
            return;
        }
        LOG.infof("Sending reset password email to %s", email);
        try {
            UsersResource users = keycloak.realm(realm).users();
            List<UserRepresentation> found = users.searchByEmail(email, true);
            if (!found.isEmpty()) {
                String userId = found.get(0).getId();
                UserResource user = users.get(userId);
                user.executeActionsEmail(clientId, redirectUri, List.of("UPDATE_PASSWORD"));
                LOG.debugf("Reset password email sent for user %s", userId);
            } else {
                LOG.warnf("No user found with email %s", email);
            }
        } catch (Exception e) {
            LOG.errorf(e, "Error sending reset password email to %s", email);
            // Toujours retourner 201, même en cas d'erreur
        }
    }

    public int changePassword(String token, ChangePasswordRequest request) {
        LOG.info("Requesting password change");
        try {
            AccessToken accessToken = TokenVerifier.create(token, AccessToken.class)
                    .getToken();
            String userId = accessToken.getSubject();
            String username = accessToken.getPreferredUsername();

            if (username == null || username.isBlank()) {
                LOG.warnf("Token missing username information for user %s", userId);
                return 400;
            }

            var loginResult = keycloakAuthService.login(username, request.currentPassword());
            if (loginResult == null) {
                LOG.errorf("Empty response when verifying current password for user %s", userId);
                return 502;
            }

            int loginStatus = loginResult.status();
            if (loginStatus != 200) {
                if (loginStatus == 400 || loginStatus == 401 || loginStatus == 403) {
                    LOG.warnf("Current password verification failed for user %s", userId);
                    return 401;
                }
                LOG.errorf("Unexpected status %d verifying current password for user %s", loginStatus, userId);
                return 502;
            }

            CredentialRepresentation cred = new CredentialRepresentation();
            cred.setTemporary(false);
            cred.setType(CredentialRepresentation.PASSWORD);
            cred.setValue(request.newPassword());

            UsersResource users = keycloak.realm(realm).users();
            UserResource user = users.get(userId);
            user.resetPassword(cred);
            LOG.debugf("Password reset for user %s", userId);
            return 204;
        } catch (KeycloakAuthService.LoginException e) {
            LOG.error("Error verifying current password with Keycloak", e);
            return 502;
        } catch (Exception e) {
            LOG.errorf(e, "Error changing password");
            return 500;
        }
    }

    public int updateUserEmail(String userId, String newEmail) {
        try {
            UsersResource users = keycloak.realm(realm).users();
            if (!users.searchByEmail(newEmail, true).isEmpty()) {
                LOG.warnf("Email %s already exists", newEmail);
                return 409;
            }
            UserResource user = users.get(userId);
            UserRepresentation rep = user.toRepresentation();
            rep.setEmail(newEmail);
            user.update(rep);
            LOG.debugf("Updated email for user %s", userId);
            return 204;
        } catch (Exception e) {
            LOG.errorf(e, "Error updating email for user %s", userId);
            return 500;
        }
    }

    public boolean updateUserName(String userId, String newName) {
        try {
            UsersResource users = keycloak.realm(realm).users();
            UserResource user = users.get(userId);
            UserRepresentation rep = user.toRepresentation();
            rep.setUsername(newName);
            rep.setFirstName(newName);
            rep.setLastName(newName);
            user.update(rep);
            LOG.debugf("Updated username for user %s", userId);
            return true;
        } catch (Exception e) {
            LOG.errorf(e, "Error updating username for user %s", userId);
            return false;
        }
    }

    public static class RegisterException extends Exception {
        private final int code;

        public RegisterException(int code) {
            this.code = code;
        }

        public int getCode() {
            return code;
        }
    }
}
