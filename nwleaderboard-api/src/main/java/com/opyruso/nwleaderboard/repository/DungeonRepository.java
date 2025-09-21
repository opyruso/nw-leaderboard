package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Dungeon;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Repository exposing read operations for {@link Dungeon} entities.
 */
@ApplicationScoped
public class DungeonRepository implements PanacheRepository<Dungeon> {
}
