package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Administrative announcement displayed to users for a limited period of time.
 */
@Entity
@Table(name = "annonce")
public class Announcement extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_annonce")
    private Long id;

    @Lob
    @Column(name = "titre", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String title;

    @Lob
    @Column(name = "content_en", nullable = false, columnDefinition = "LONGTEXT")
    private String contentEn;

    @Lob
    @Column(name = "content_de", nullable = false, columnDefinition = "LONGTEXT")
    private String contentDe;

    @Lob
    @Column(name = "content_fr", nullable = false, columnDefinition = "LONGTEXT")
    private String contentFr;

    @Lob
    @Column(name = "content_es", nullable = false, columnDefinition = "LONGTEXT")
    private String contentEs;

    @Lob
    @Column(name = "content_esmx", nullable = false, columnDefinition = "LONGTEXT")
    private String contentEsmx;

    @Lob
    @Column(name = "content_it", nullable = false, columnDefinition = "LONGTEXT")
    private String contentIt;

    @Lob
    @Column(name = "content_pl", nullable = false, columnDefinition = "LONGTEXT")
    private String contentPl;

    @Lob
    @Column(name = "content_pt", nullable = false, columnDefinition = "LONGTEXT")
    private String contentPt;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDateTime endDate;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContentEn() {
        return contentEn;
    }

    public void setContentEn(String contentEn) {
        this.contentEn = contentEn;
    }

    public String getContentDe() {
        return contentDe;
    }

    public void setContentDe(String contentDe) {
        this.contentDe = contentDe;
    }

    public String getContentFr() {
        return contentFr;
    }

    public void setContentFr(String contentFr) {
        this.contentFr = contentFr;
    }

    public String getContentEs() {
        return contentEs;
    }

    public void setContentEs(String contentEs) {
        this.contentEs = contentEs;
    }

    public String getContentEsmx() {
        return contentEsmx;
    }

    public void setContentEsmx(String contentEsmx) {
        this.contentEsmx = contentEsmx;
    }

    public String getContentIt() {
        return contentIt;
    }

    public void setContentIt(String contentIt) {
        this.contentIt = contentIt;
    }

    public String getContentPl() {
        return contentPl;
    }

    public void setContentPl(String contentPl) {
        this.contentPl = contentPl;
    }

    public String getContentPt() {
        return contentPt;
    }

    public void setContentPt(String contentPt) {
        this.contentPt = contentPt;
    }

    public LocalDateTime getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
    }

    public LocalDateTime getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDateTime endDate) {
        this.endDate = endDate;
    }
}
