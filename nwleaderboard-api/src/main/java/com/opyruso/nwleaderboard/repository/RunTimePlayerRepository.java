package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunTimePlayer;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Repository for {@link RunTimePlayer} association entities.
 */
@ApplicationScoped
public class RunTimePlayerRepository implements PanacheRepository<RunTimePlayer> {
}
