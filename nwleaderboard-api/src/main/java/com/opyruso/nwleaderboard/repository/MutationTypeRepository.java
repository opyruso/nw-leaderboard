package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.MutationType;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link MutationType} records.
 */
@ApplicationScoped
public class MutationTypeRepository implements PanacheRepository<MutationType> {

    public List<MutationType> listEnabled() {
        return list("enable", true);
    }
}
