package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.MutationPromotion;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link MutationPromotion} records.
 */
@ApplicationScoped
public class MutationPromotionRepository implements PanacheRepositoryBase<MutationPromotion, String> {

    public List<MutationPromotion> listEnabled() {
        return list("enable", true);
    }
}
