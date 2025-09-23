package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.repository.DungeonRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Provides write operations for dungeon metadata such as highlight selection.
 */
@ApplicationScoped
public class DungeonService {

    @Inject
    DungeonRepository dungeonRepository;

    @Transactional
    public void updateHighlightedDungeons(Collection<Long> highlightedIds) {
        Set<Long> targets = normaliseIds(highlightedIds);
        List<Dungeon> allDungeons = dungeonRepository.listAll();
        for (Dungeon dungeon : allDungeons) {
            if (dungeon == null) {
                continue;
            }
            Long dungeonId = dungeon.getId();
            boolean shouldHighlight = dungeonId != null && targets.contains(dungeonId);
            if (dungeon.isHighlighted() != shouldHighlight) {
                dungeon.setHighlighted(shouldHighlight);
            }
        }
    }

    private Set<Long> normaliseIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Set.of();
        }
        Set<Long> normalised = new HashSet<>();
        for (Long id : ids) {
            if (id == null) {
                continue;
            }
            long value = id;
            if (value > 0) {
                normalised.add(value);
            }
        }
        return normalised;
    }
}
