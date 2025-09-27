package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.MutationPromotion;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link MutationPromotion} records.
 */
@ApplicationScoped
public class MutationPromotionRepository implements PanacheRepository<MutationPromotion> {

    public List<MutationPromotion> listEnabled() {
        return list("enable", true);
    }
}
