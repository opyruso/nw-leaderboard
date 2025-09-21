package com.opyruso.nwleaderboard;

import io.quarkus.vertx.http.runtime.filters.RouteFilter;
import io.vertx.ext.web.RoutingContext;
import jakarta.inject.Singleton;
import jakarta.ws.rs.core.HttpHeaders;

@Singleton
public class VersionCacheControlFilter {

    private static final String NO_CACHE_HEADER = "no-store, no-cache, must-revalidate";

    @RouteFilter(100)
    void addNoCacheHeaders(RoutingContext context) {
        if ("/version.txt".equals(context.normalizedPath())) {
            context.addHeadersEndHandler(ignored -> {
                context.response().headers().set(HttpHeaders.CACHE_CONTROL, NO_CACHE_HEADER);
                context.response().headers().set("Pragma", "no-cache");
                context.response().headers().set("Expires", "0");
            });
        }
        context.next();
    }
}
