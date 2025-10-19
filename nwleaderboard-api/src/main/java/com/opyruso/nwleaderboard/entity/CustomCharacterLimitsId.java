package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/**
 * Embedded identifier for weekly custom character limits.
 */
@Embeddable
public class CustomCharacterLimitsId implements Serializable {

    private static final long serialVersionUID = 1L;

    @Column(name = "custom_character_id")
    private Long customCharacterId;

    @Column(name = "week")
    private Integer week;

    public CustomCharacterLimitsId() {
    }

    public CustomCharacterLimitsId(Long customCharacterId, Integer week) {
        this.customCharacterId = customCharacterId;
        this.week = week;
    }

    public Long getCustomCharacterId() {
        return customCharacterId;
    }

    public void setCustomCharacterId(Long customCharacterId) {
        this.customCharacterId = customCharacterId;
    }

    public Integer getWeek() {
        return week;
    }

    public void setWeek(Integer week) {
        this.week = week;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CustomCharacterLimitsId other)) {
            return false;
        }
        return Objects.equals(customCharacterId, other.customCharacterId) && Objects.equals(week, other.week);
    }

    @Override
    public int hashCode() {
        return Objects.hash(customCharacterId, week);
    }
}
