package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.MutationCurse;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing read operations for {@link MutationCurse} records.
 */
@ApplicationScoped
public class MutationCurseRepository implements PanacheRepositoryBase<MutationCurse, String> {

    public List<MutationCurse> listEnabled() {
        return list("enable", true);
    }
}
