package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Entity storing the outcome of an OCR extraction so it can be validated later on.
 */
@Entity
@Table(name = "scan_leaderboard")
public class ScanLeaderboard extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_scan_leaderboard")
    private Long id;

    @Column(name = "width", nullable = false)
    private Integer width;

    @Column(name = "heigth", nullable = false)
    private Integer height;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "picture", nullable = false, columnDefinition = "LONGBLOB")
    private byte[] picture;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "extract_data", nullable = false, columnDefinition = "LONGTEXT")
    private String extractData;

    @Column(name = "week", nullable = false)
    private Integer week;

    @Column(name = "id_dungeon", nullable = false)
    private Long dungeonId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_region", nullable = false, columnDefinition = "VARCHAR(3) DEFAULT 'EUC'")
    private Region region;

    @Column(name = "leaderboard_type", nullable = false)
    private String leaderboardType;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getWidth() {
        return width;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public Integer getHeight() {
        return height;
    }

    public void setHeight(Integer height) {
        this.height = height;
    }

    public byte[] getPicture() {
        return picture;
    }

    public void setPicture(byte[] picture) {
        this.picture = picture;
    }

    public String getExtractData() {
        return extractData;
    }

    public void setExtractData(String extractData) {
        this.extractData = extractData;
    }

    public Integer getWeek() {
        return week;
    }

    public void setWeek(Integer week) {
        this.week = week;
    }

    public Long getDungeonId() {
        return dungeonId;
    }

    public void setDungeonId(Long dungeonId) {
        this.dungeonId = dungeonId;
    }

    public Region getRegion() {
        return region;
    }

    public void setRegion(Region region) {
        this.region = region;
    }

    public String getLeaderboardType() {
        return leaderboardType;
    }

    public void setLeaderboardType(String leaderboardType) {
        this.leaderboardType = leaderboardType;
    }
}
