package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

/**
 * Entity storing per-week limits for a custom character.
 */
@Entity
@Table(name = "custom_character_limits")
public class CustomCharacterLimits extends Auditable {

    @EmbeddedId
    private CustomCharacterLimitsId id;

    @MapsId("customCharacterId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "custom_character_id", nullable = false)
    private CustomCharacter customCharacter;

    @Column(name = "week_umbrals_cap", nullable = false)
    private Integer weekUmbralsCap = 0;

    @Column(name = "week_winter_limit", nullable = false)
    private Integer weekWinterLimit = 0;

    @Column(name = "week_hatchery_limit", nullable = false)
    private Integer weekHatcheryLimit = 0;

    public CustomCharacterLimitsId getId() {
        return id;
    }

    public void setId(CustomCharacterLimitsId id) {
        this.id = id;
    }

    public CustomCharacter getCustomCharacter() {
        return customCharacter;
    }

    public void setCustomCharacter(CustomCharacter customCharacter) {
        this.customCharacter = customCharacter;
        if (id == null) {
            id = new CustomCharacterLimitsId();
        }
        if (customCharacter != null) {
            id.setCustomCharacterId(customCharacter.getId());
        }
    }

    public Integer getWeek() {
        return id != null ? id.getWeek() : null;
    }

    public void setWeek(Integer week) {
        if (id == null) {
            id = new CustomCharacterLimitsId();
        }
        id.setWeek(week);
    }

    public Integer getWeekUmbralsCap() {
        return weekUmbralsCap;
    }

    public void setWeekUmbralsCap(Integer weekUmbralsCap) {
        this.weekUmbralsCap = weekUmbralsCap;
    }

    public Integer getWeekWinterLimit() {
        return weekWinterLimit;
    }

    public void setWeekWinterLimit(Integer weekWinterLimit) {
        this.weekWinterLimit = weekWinterLimit;
    }

    public Integer getWeekHatcheryLimit() {
        return weekHatcheryLimit;
    }

    public void setWeekHatcheryLimit(Integer weekHatcheryLimit) {
        this.weekHatcheryLimit = weekHatcheryLimit;
    }
}
