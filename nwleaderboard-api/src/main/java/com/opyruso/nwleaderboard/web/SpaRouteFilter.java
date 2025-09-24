package com.opyruso.nwleaderboard.web;

import io.quarkus.vertx.http.runtime.filters.RouteFilter;
import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Set;

/**
 * Ensures that deep links to the single-page application routes work when the
 * user refreshes the page or directly accesses a nested path. Quarkus would
 * normally return a 404 for unknown static resources, so we reroute those
 * requests back to the SPA entry point instead.
 */
@ApplicationScoped
public class SpaRouteFilter {

    private static final Set<String> IGNORED_PREFIXES = Set.of(
            "/api",
            "/q/",
            "/live",
            "/health",
            "/swagger-ui",
            "/openapi",
            "/metrics"
    );

    @RouteFilter(100)
    void rerouteSpaPaths(RoutingContext context) {
        if (context.request().method() != HttpMethod.GET) {
            return;
        }

        final String path = context.normalizedPath();
        if (path == null || path.isEmpty() || "/".equals(path)) {
            return;
        }

        for (String ignoredPrefix : IGNORED_PREFIXES) {
            if (path.startsWith(ignoredPrefix)) {
                return;
            }
        }

        if (path.contains(".")) {
            return;
        }

        context.reroute("/");
    }
}
