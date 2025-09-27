package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.MutationElement;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link MutationElement} records.
 */
@ApplicationScoped
public class MutationElementRepository implements PanacheRepository<MutationElement> {

    public List<MutationElement> listEnabled() {
        return list("enable", true);
    }
}
