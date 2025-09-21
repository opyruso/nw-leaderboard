package com.opyruso.nwleaderboard;

import io.quarkus.runtime.StartupEvent;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

@ApplicationScoped
public class VersionCacheControlFilter {

    private static final String VERSION_PATH = "/version.txt";
    private static final String CACHE_CONTROL_HEADER = "no-store, no-cache, must-revalidate";

    private final Router router;

    public VersionCacheControlFilter(Router router) {
        this.router = router;
    }

    void registerFilter(@Observes StartupEvent event) {
        router.route(VERSION_PATH).order(-100).handler(this::addNoCacheHeaders);
    }

    private void addNoCacheHeaders(RoutingContext context) {
        context.addHeadersEndHandler(ignored -> {
            context.response().headers().set("Cache-Control", CACHE_CONTROL_HEADER);
            context.response().headers().set("Pragma", "no-cache");
            context.response().headers().set("Expires", "0");
        });
        context.next();
    }
}
