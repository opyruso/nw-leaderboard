package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;

/**
 * Entity storing a user-defined character for weekly tracking.
 */
@Entity
@Table(name = "custom_character")
public class CustomCharacter extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "custom_character_id")
    private Long id;

    @Column(name = "user_id", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String userId;

    @Column(name = "custom_character_name", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String name;

    @Column(name = "deleted", nullable = false)
    private boolean deleted = false;

    @OneToMany(mappedBy = "customCharacter", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Set<CustomCharacterLimits> weeklyLimits = new HashSet<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }

    public Set<CustomCharacterLimits> getWeeklyLimits() {
        return weeklyLimits;
    }

    public void setWeeklyLimits(Set<CustomCharacterLimits> weeklyLimits) {
        this.weeklyLimits = weeklyLimits;
    }
}
