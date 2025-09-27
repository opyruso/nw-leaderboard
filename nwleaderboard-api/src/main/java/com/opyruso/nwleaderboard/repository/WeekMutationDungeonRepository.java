package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.WeekMutationDungeon;
import com.opyruso.nwleaderboard.entity.WeekMutationDungeonId;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository exposing CRUD operations for {@link WeekMutationDungeon} entities.
 */
@ApplicationScoped
public class WeekMutationDungeonRepository implements PanacheRepository<WeekMutationDungeon> {

    public List<WeekMutationDungeon> listAllWithRelations() {
        return getEntityManager()
                .createQuery(
                        "SELECT w FROM WeekMutationDungeon w "
                                + "JOIN FETCH w.dungeon "
                                + "JOIN FETCH w.mutationElement "
                                + "JOIN FETCH w.mutationType "
                                + "JOIN FETCH w.mutationPromotion "
                                + "JOIN FETCH w.mutationCurse",
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
}
