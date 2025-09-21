package com.opyruso.nwleaderboard.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import io.quarkus.runtime.Startup;
import jakarta.annotation.PostConstruct;
import jakarta.inject.Singleton;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@Singleton
@Startup
public class LogDirectoryInitializer {

    private static final Logger LOG = Logger.getLogger(LogDirectoryInitializer.class);

    @ConfigProperty(name = "quarkus.log.file.enable", defaultValue = "false")
    boolean fileLoggingEnabled;

    @ConfigProperty(name = "quarkus.log.file.path", defaultValue = "")
    String logFilePath;

    @PostConstruct
    void initLogDirectory() {
        if (!fileLoggingEnabled) {
            return;
        }

        if (logFilePath == null || logFilePath.isBlank()) {
            LOG.warn("File logging is enabled but no log file path has been configured.");
            return;
        }

        Path logFile = Paths.get(logFilePath).toAbsolutePath();
        Path logDirectory = logFile.getParent();
        if (logDirectory == null) {
            return;
        }

        if (Files.exists(logDirectory)) {
            return;
        }

        try {
            Files.createDirectories(logDirectory);
            LOG.debugf("Created log directory %s", logDirectory);
        } catch (IOException | SecurityException e) {
            LOG.warnf(e, "Unable to create log directory %s for file logging", logDirectory);
        }
    }
}
