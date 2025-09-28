package com.opyruso.nwleaderboard.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

/**
 * Entity linking dungeon mutations configured for a specific week.
 */
@Entity
@Table(name = "week_mutation_dungeon")
public class WeekMutationDungeon extends Auditable {

    @EmbeddedId
    private WeekMutationDungeonId id;

    @MapsId("dungeonId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_dungeon", nullable = false)
    private Dungeon dungeon;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_mutation_element", nullable = false)
    private MutationElement mutationElement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_mutation_type", nullable = false)
    private MutationType mutationType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_mutation_promotion", nullable = false)
    private MutationPromotion mutationPromotion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_mutation_curse", nullable = false)
    private MutationCurse mutationCurse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_season")
    private Season season;

    public WeekMutationDungeonId getId() {
        return id;
    }

    public void setId(WeekMutationDungeonId id) {
        this.id = id;
    }

    public Integer getWeek() {
        return id != null ? id.getWeek() : null;
    }

    public void setWeek(Integer week) {
        if (id == null) {
            id = new WeekMutationDungeonId();
        }
        id.setWeek(week);
    }

    public Dungeon getDungeon() {
        return dungeon;
    }

    public void setDungeon(Dungeon dungeon) {
        this.dungeon = dungeon;
        if (id == null) {
            id = new WeekMutationDungeonId();
        }
        id.setDungeonId(dungeon != null ? dungeon.getId() : null);
    }

    public MutationElement getMutationElement() {
        return mutationElement;
    }

    public void setMutationElement(MutationElement mutationElement) {
        this.mutationElement = mutationElement;
    }

    public MutationType getMutationType() {
        return mutationType;
    }

    public void setMutationType(MutationType mutationType) {
        this.mutationType = mutationType;
    }

    public MutationPromotion getMutationPromotion() {
        return mutationPromotion;
    }

    public void setMutationPromotion(MutationPromotion mutationPromotion) {
        this.mutationPromotion = mutationPromotion;
    }

    public MutationCurse getMutationCurse() {
        return mutationCurse;
    }

    public void setMutationCurse(MutationCurse mutationCurse) {
        this.mutationCurse = mutationCurse;
    }

    public Season getSeason() {
        return season;
    }

    public void setSeason(Season season) {
        this.season = season;
    }
}
