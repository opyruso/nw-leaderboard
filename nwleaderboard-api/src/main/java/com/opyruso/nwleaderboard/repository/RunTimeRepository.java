package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunTime;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Repository for {@link RunTime} entities extracted from contributor uploads.
 */
@ApplicationScoped
public class RunTimeRepository implements PanacheRepository<RunTime> {
}
