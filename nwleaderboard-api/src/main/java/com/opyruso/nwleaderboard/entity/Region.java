package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Represents a geographical region supported by the leaderboard.
 */
@Entity
@Table(name = "region")
public class Region {

    public static final String ID_EUROPE_CENTRAL = "EUC";
    public static final String ID_US_EAST = "USE";
    public static final String ID_US_WEST = "USW";
    public static final String ID_SOUTH_AMERICA_EAST = "SAE";
    public static final String ID_ASIA_PACIFIC_SOUTHEAST = "APS";

    @Id
    @Column(name = "id_region", nullable = false, updatable = false, length = 3)
    private String id;

    public Region() {
        // Default constructor required by JPA
    }

    public Region(String id) {
        this.id = id;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }
}
