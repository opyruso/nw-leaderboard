package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Dungeon;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link Dungeon} entities.
 */
@ApplicationScoped
public class DungeonRepository implements PanacheRepository<Dungeon> {

    public List<Dungeon> listHighlighted() {
        return list("highlighted", true);
    }
}
