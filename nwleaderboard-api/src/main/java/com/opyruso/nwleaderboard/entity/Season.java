package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Entity representing a gameplay season.
 */
@Entity
@Table(name = "season")
public class Season extends Auditable {

    @Id
    @Column(name = "id_season")
    private Integer id;

    @Column(name = "date_begin", nullable = false)
    private LocalDate dateBegin;

    @Column(name = "date_end", nullable = false)
    private LocalDate dateEnd;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public LocalDate getDateBegin() {
        return dateBegin;
    }

    public void setDateBegin(LocalDate dateBegin) {
        this.dateBegin = dateBegin;
    }

    public LocalDate getDateEnd() {
        return dateEnd;
    }

    public void setDateEnd(LocalDate dateEnd) {
        this.dateEnd = dateEnd;
    }
}
