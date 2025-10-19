package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.CustomCharacterLimits;
import com.opyruso.nwleaderboard.entity.CustomCharacterLimitsId;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Collection;
import java.util.List;

/**
 * Repository for accessing {@link CustomCharacterLimits} entities.
 */
@ApplicationScoped
public class CustomCharacterLimitsRepository
        implements PanacheRepositoryBase<CustomCharacterLimits, CustomCharacterLimitsId> {

    public List<CustomCharacterLimits> listByCharacterIdsAndWeek(Collection<Long> characterIds, Integer week) {
        if (characterIds == null || characterIds.isEmpty() || week == null) {
            return List.of();
        }
        return find("customCharacter.id IN ?1 AND id.week = ?2", characterIds, week).list();
    }
}
