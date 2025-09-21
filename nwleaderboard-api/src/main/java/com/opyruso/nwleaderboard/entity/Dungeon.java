package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Entity representing a dungeon.
 */
@Entity
@Table(name = "dungeon")
public class Dungeon extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_dungeon")
    private Long id;

    @Column(name = "name_local_en", nullable = false)
    private String nameLocalEn;

    @Column(name = "name_local_fr", nullable = false)
    private String nameLocalFr;

    @Column(name = "name_local_de", nullable = false)
    private String nameLocalDe;

    @Column(name = "name_local_es", nullable = false)
    private String nameLocalEs;

    @Column(name = "name_local_esmx", nullable = false)
    private String nameLocalEsmx;

    @Column(name = "name_local_it", nullable = false)
    private String nameLocalIt;

    @Column(name = "name_local_pl", nullable = false)
    private String nameLocalPl;

    @Column(name = "name_local_pt", nullable = false)
    private String nameLocalPt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNameLocalEn() {
        return nameLocalEn;
    }

    public void setNameLocalEn(String nameLocalEn) {
        this.nameLocalEn = nameLocalEn;
    }

    public String getNameLocalFr() {
        return nameLocalFr;
    }

    public void setNameLocalFr(String nameLocalFr) {
        this.nameLocalFr = nameLocalFr;
    }

    public String getNameLocalDe() {
        return nameLocalDe;
    }

    public void setNameLocalDe(String nameLocalDe) {
        this.nameLocalDe = nameLocalDe;
    }

    public String getNameLocalEs() {
        return nameLocalEs;
    }

    public void setNameLocalEs(String nameLocalEs) {
        this.nameLocalEs = nameLocalEs;
    }

    public String getNameLocalEsmx() {
        return nameLocalEsmx;
    }

    public void setNameLocalEsmx(String nameLocalEsmx) {
        this.nameLocalEsmx = nameLocalEsmx;
    }

    public String getNameLocalIt() {
        return nameLocalIt;
    }

    public void setNameLocalIt(String nameLocalIt) {
        this.nameLocalIt = nameLocalIt;
    }

    public String getNameLocalPl() {
        return nameLocalPl;
    }

    public void setNameLocalPl(String nameLocalPl) {
        this.nameLocalPl = nameLocalPl;
    }

    public String getNameLocalPt() {
        return nameLocalPt;
    }

    public void setNameLocalPt(String nameLocalPt) {
        this.nameLocalPt = nameLocalPt;
    }
}
