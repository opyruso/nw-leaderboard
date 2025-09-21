package com.opyruso.nwleaderboard.entity;

import jakarta.enterprise.inject.spi.CDI;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import java.time.LocalDateTime;
import io.quarkus.security.identity.SecurityIdentity;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * JPA entity listener to populate audit columns.
 */
public class AuditListener {

    private String currentUser() {
        try {
            SecurityIdentity identity = CDI.current().select(SecurityIdentity.class).get();
            if (identity != null && !identity.isAnonymous()) {
                JsonWebToken jwt = CDI.current().select(JsonWebToken.class).get();
                if (jwt != null && jwt.getSubject() != null && !jwt.getSubject().isBlank()) {
                    return jwt.getSubject();
                }
            }
        } catch (Exception ignored) {
        }
        return "system";
    }

    @PrePersist
    public void prePersist(Auditable entity) {
        LocalDateTime now = LocalDateTime.now();
        String user = currentUser();
        entity.setCreationDate(now);
        entity.setCreationUser(user);
        entity.setUpdateDate(now);
        entity.setUpdateUser(user);
    }

    @PreUpdate
    public void preUpdate(Auditable entity) {
        entity.setUpdateDate(LocalDateTime.now());
        entity.setUpdateUser(currentUser());
    }

    @PreRemove
    public void preRemove(Auditable entity) {
        entity.setUpdateDate(LocalDateTime.now());
        entity.setUpdateUser(currentUser());
    }

    @PostLoad
    public void postLoad(Auditable entity) {
        if (entity.getUpdateDate() == null) {
            LocalDateTime defaultDate = entity.getCreationDate() != null ? entity.getCreationDate() : LocalDateTime.now();
            entity.setUpdateDate(defaultDate);
        }
        if (entity.getUpdateUser() == null) {
            String defaultUser = entity.getCreationUser() != null ? entity.getCreationUser() : "system";
            entity.setUpdateUser(defaultUser);
        }
    }
}

