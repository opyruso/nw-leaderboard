package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Entity representing a mutation promotion configuration.
 */
@Entity
@Table(name = "mutation_promotion")
public class MutationPromotion extends Auditable {

    @Id
    @Column(name = "id_mutation_promotion", nullable = false, length = 64)
    private String id;

    @Column(name = "enable", nullable = false, columnDefinition = "BOOLEAN DEFAULT TRUE")
    private boolean enable = true;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public boolean isEnable() {
        return enable;
    }

    public void setEnable(boolean enable) {
        this.enable = enable;
    }
}
