package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.MutationElement;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link MutationElement} records.
 */
@ApplicationScoped
public class MutationElementRepository implements PanacheRepositoryBase<MutationElement, String> {

    public List<MutationElement> listEnabled() {
        return list("enable", true);
    }
}
