package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Region;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

/** Repository providing access to {@link Region} entities. */
@ApplicationScoped
public class RegionRepository implements PanacheRepositoryBase<Region, String> {
}
