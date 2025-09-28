package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Season;
import com.opyruso.nwleaderboard.entity.WeekMutationDungeon;
import com.opyruso.nwleaderboard.entity.WeekMutationDungeonId;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Set;

/**
 * Repository exposing CRUD operations for {@link WeekMutationDungeon} entities.
 */
@ApplicationScoped
public class WeekMutationDungeonRepository implements PanacheRepositoryBase<WeekMutationDungeon, WeekMutationDungeonId> {

    public List<WeekMutationDungeon> listAllWithRelations() {
        return getEntityManager()
                .createQuery(
                        "SELECT w FROM WeekMutationDungeon w "
                                + "JOIN FETCH w.dungeon "
                                + "JOIN FETCH w.mutationElement "
                                + "JOIN FETCH w.mutationType "
                                + "JOIN FETCH w.mutationPromotion "
                                + "JOIN FETCH w.mutationCurse "
                                + "LEFT JOIN FETCH w.season",
                        WeekMutationDungeon.class)
                .getResultList();
    }

    public WeekMutationDungeon findByIds(Integer week, Long dungeonId) {
        if (week == null || dungeonId == null) {
            return null;
        }
        WeekMutationDungeonId id = new WeekMutationDungeonId(week, dungeonId);
        return findById(id);
    }

    public List<Integer> findWeekNumbersByFilters(
            Long dungeonId, Set<String> typeIds, Set<String> promotionIds, Set<String> curseIds) {
        if (dungeonId == null) {
            return List.of();
        }

        StringBuilder jpql = new StringBuilder(
                "SELECT DISTINCT w.id.week FROM WeekMutationDungeon w WHERE w.dungeon.id = :dungeonId");
        if (typeIds != null && !typeIds.isEmpty()) {
            jpql.append(" AND w.mutationType.id IN :typeIds");
        }
        if (promotionIds != null && !promotionIds.isEmpty()) {
            jpql.append(" AND w.mutationPromotion.id IN :promotionIds");
        }
        if (curseIds != null && !curseIds.isEmpty()) {
            jpql.append(" AND w.mutationCurse.id IN :curseIds");
        }
        jpql.append(" ORDER BY w.id.week DESC");

        var query = getEntityManager().createQuery(jpql.toString(), Integer.class).setParameter("dungeonId", dungeonId);
        if (typeIds != null && !typeIds.isEmpty()) {
            query.setParameter("typeIds", typeIds);
        }
        if (promotionIds != null && !promotionIds.isEmpty()) {
            query.setParameter("promotionIds", promotionIds);
        }
        if (curseIds != null && !curseIds.isEmpty()) {
            query.setParameter("curseIds", curseIds);
        }
        return query.getResultList();
    }

    public int assignSeasonToPreviousWeeks(Integer week, Season season) {
        if (week == null || season == null) {
            return 0;
        }
        return getEntityManager()
                .createQuery(
                        "UPDATE WeekMutationDungeon w SET w.season = :season "
                                + "WHERE w.id.week <= :week AND w.season IS NULL")
                .setParameter("season", season)
                .setParameter("week", week)
                .executeUpdate();
    }
}
