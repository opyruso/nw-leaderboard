package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScore;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Repository for persisting {@link RunScore} entities extracted from contributor uploads.
 */
@ApplicationScoped
public class RunScoreRepository implements PanacheRepository<RunScore> {
}
