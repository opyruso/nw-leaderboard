package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Announcement;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository handling persistence for {@link Announcement} entities.
 */
@ApplicationScoped
public class AnnouncementRepository implements PanacheRepository<Announcement> {

    public List<Announcement> listActive(LocalDateTime reference) {
        return list("startDate <= ?1 and endDate >= ?1 order by startDate desc", reference);
    }

    public List<Announcement> listAllByStartDateDesc() {
        return listAll(Sort.by("startDate").descending());
    }
}
