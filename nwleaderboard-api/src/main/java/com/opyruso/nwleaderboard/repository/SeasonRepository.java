package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Season;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing CRUD operations for {@link Season} entities.
 */
@ApplicationScoped
public class SeasonRepository implements PanacheRepositoryBase<Season, Integer> {

    public List<Season> listAllOrderByDateBeginDesc() {
        return find("ORDER BY dateBegin DESC, id DESC").list();
    }

    public Season findLatestByDateBegin() {
        return find("ORDER BY dateBegin DESC").firstResult();
    }
}
