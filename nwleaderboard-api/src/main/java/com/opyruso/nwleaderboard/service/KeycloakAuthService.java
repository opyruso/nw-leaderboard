package com.opyruso.nwleaderboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Service utilitaire pour l'authentification auprès de Keycloak.
 */
@ApplicationScoped
public class KeycloakAuthService {

    private static final Logger LOG = Logger.getLogger(KeycloakAuthService.class);

    @ConfigProperty(name = "auth.admin.url")
    String serverUrl;

    @ConfigProperty(name = "auth.admin.realm")
    String realm;

    @ConfigProperty(name = "auth.admin.client-id")
    String clientId;

    @ConfigProperty(name = "auth.admin.client-secret", defaultValue = "")
    String clientSecret;

    HttpClient httpClient;

    final ObjectMapper objectMapper;

    public KeycloakAuthService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void init() {
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public LoginResult login(String username, String password) throws LoginException {
        try {
            String tokenEndpoint = "%s/realms/%s/protocol/openid-connect/token".formatted(serverUrl, realm);
            String form = buildForm(username, password);
            HttpRequest request = HttpRequest.newBuilder(URI.create(tokenEndpoint))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode payload = parseBody(response.body());
            return new LoginResult(response.statusCode(), payload);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LoginException("Interrupted while contacting Keycloak", e);
        } catch (IOException e) {
            throw new LoginException("Unable to reach Keycloak", e);
        }
    }

    private String buildForm(String username, String password) {
        StringBuilder builder = new StringBuilder();
        builder.append("grant_type=password");
        builder.append("&username=").append(encode(username));
        builder.append("&password=").append(encode(password));
        builder.append("&client_id=").append(encode(clientId));
        if (clientSecret != null && !clientSecret.isBlank()) {
            builder.append("&client_secret=").append(encode(clientSecret));
        }
        return builder.toString();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private JsonNode parseBody(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(body);
        } catch (IOException e) {
            LOG.warn("Unable to parse authentication response", e);
            return null;
        }
    }

    public record LoginResult(int status, JsonNode body) {
    }

    public static class LoginException extends Exception {
        public LoginException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}

