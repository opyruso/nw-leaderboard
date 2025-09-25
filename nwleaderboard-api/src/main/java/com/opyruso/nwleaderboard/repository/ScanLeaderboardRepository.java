package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.ScanLeaderboard;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Repository handling persistence for {@link ScanLeaderboard} entities.
 */
@ApplicationScoped
public class ScanLeaderboardRepository implements PanacheRepository<ScanLeaderboard> {
}
