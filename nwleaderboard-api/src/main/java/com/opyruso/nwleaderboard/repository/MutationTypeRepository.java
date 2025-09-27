package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.MutationType;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link MutationType} records.
 */
@ApplicationScoped
public class MutationTypeRepository implements PanacheRepositoryBase<MutationType, String> {

    public List<MutationType> listEnabled() {
        return list("enable", true);
    }
}
