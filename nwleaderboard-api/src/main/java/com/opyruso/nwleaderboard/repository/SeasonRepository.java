package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Season;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
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

    public boolean existsById(Integer id) {
        if (id == null) {
            return false;
        }
        return findById(id) != null;
    }

    public boolean existsByDateBegin(LocalDate dateBegin) {
        if (dateBegin == null) {
            return false;
        }
        return find("dateBegin = ?1", dateBegin).firstResultOptional().isPresent();
    }

    public boolean existsByDateEnd(LocalDate dateEnd) {
        if (dateEnd == null) {
            return false;
        }
        return find("dateEnd = ?1", dateEnd).firstResultOptional().isPresent();
    }

    public boolean existsByDateRange(LocalDate dateBegin, LocalDate dateEnd) {
        if (dateBegin == null || dateEnd == null) {
            return false;
        }
        return find("dateBegin = ?1 AND dateEnd = ?2", dateBegin, dateEnd).firstResultOptional().isPresent();
    }
}
