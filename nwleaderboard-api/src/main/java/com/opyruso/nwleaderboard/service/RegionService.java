package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.entity.Region;
import com.opyruso.nwleaderboard.repository.RegionRepository;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Provides helper methods to work with {@link Region} entities and ensures the reference data exists.
 */
@ApplicationScoped
public class RegionService {

    private static final List<String> SUPPORTED_REGION_IDS = List.of(
            Region.ID_EUROPE_CENTRAL,
            Region.ID_US_EAST,
            Region.ID_US_WEST,
            Region.ID_SOUTH_AMERICA_EAST,
            Region.ID_ASIA_PACIFIC_SOUTHEAST);

    @Inject
    RegionRepository regionRepository;

    @PostConstruct
    @Transactional
    void initialiseRegions() {
        for (String regionId : SUPPORTED_REGION_IDS) {
            if (regionRepository.findById(regionId) == null) {
                Region region = new Region();
                region.setId(regionId);
                regionRepository.persist(region);
            }
        }

        Region defaultRegion = regionRepository.findById(Region.ID_EUROPE_CENTRAL);
        if (defaultRegion != null) {
            regionRepository.getEntityManager()
                    .createQuery("UPDATE Player p SET p.region = :region WHERE p.region IS NULL")
                    .setParameter("region", defaultRegion)
                    .executeUpdate();
            regionRepository.getEntityManager()
                    .createQuery("UPDATE RunScore r SET r.region = :region WHERE r.region IS NULL")
                    .setParameter("region", defaultRegion)
                    .executeUpdate();
            regionRepository.getEntityManager()
                    .createQuery("UPDATE RunTime r SET r.region = :region WHERE r.region IS NULL")
                    .setParameter("region", defaultRegion)
                    .executeUpdate();
            regionRepository.getEntityManager()
                    .createQuery("UPDATE ScanLeaderboard s SET s.region = :region WHERE s.region IS NULL")
                    .setParameter("region", defaultRegion)
                    .executeUpdate();
        }
    }

    /** Returns the default region used when none is provided explicitly. */
    @Transactional(Transactional.TxType.SUPPORTS)
    public Region requireDefaultRegion() {
        return resolveRegionOrDefault(Region.ID_EUROPE_CENTRAL);
    }

    /** Resolves a region by its identifier or throws an {@link IllegalStateException} when missing. */
    @Transactional(Transactional.TxType.SUPPORTS)
    public Region requireRegion(String rawId) {
        Region region = resolveRegion(rawId);
        if (region == null) {
            throw new IllegalStateException("Unknown region " + (rawId != null ? rawId : ""));
        }
        return region;
    }

    /** Returns the region matching the provided identifier or {@code null} when it cannot be resolved. */
    @Transactional(Transactional.TxType.SUPPORTS)
    public Region resolveRegion(String rawId) {
        if (rawId == null || rawId.isBlank()) {
            return null;
        }
        String normalised = rawId.trim().toUpperCase(Locale.ROOT);
        return regionRepository.findById(normalised);
    }

    /** Resolves a region or falls back to the default region when none is provided. */
    @Transactional(Transactional.TxType.SUPPORTS)
    public Region resolveRegionOrDefault(String rawId) {
        Region region = resolveRegion(rawId);
        if (region != null) {
            return region;
        }
        Region fallback = regionRepository.findById(Region.ID_EUROPE_CENTRAL);
        if (fallback == null) {
            throw new IllegalStateException("Default region is not available");
        }
        return fallback;
    }

    /** Returns all supported regions ordered by their identifier. */
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<Region> listRegions() {
        List<Region> regions = new ArrayList<>(SUPPORTED_REGION_IDS.size());
        for (String regionId : SUPPORTED_REGION_IDS) {
            Region region = regionRepository.findById(regionId);
            if (region == null) {
                region = new Region(regionId);
            }
            regions.add(region);
        }
        return regions;
    }
}
