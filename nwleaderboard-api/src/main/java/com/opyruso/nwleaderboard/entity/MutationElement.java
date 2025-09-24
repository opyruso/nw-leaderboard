package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Entity representing a mutation element configuration.
 */
@Entity
@Table(name = "mutation_element")
public class MutationElement extends Auditable {

    @Id
    @Column(name = "id_mutation_element", nullable = false, length = 64)
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
