package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Repository for {@link RunScorePlayer} association entities.
 */
@ApplicationScoped
public class RunScorePlayerRepository implements PanacheRepository<RunScorePlayer> {
}
