package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.CustomCharacter;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.Objects;

/**
 * Repository exposing CRUD operations for {@link CustomCharacter} entities.
 */
@ApplicationScoped
public class CustomCharacterRepository implements PanacheRepository<CustomCharacter> {

    public List<CustomCharacter> listByUserId(String userId, boolean includeDeleted) {
        if (userId == null || userId.isBlank()) {
            return List.of();
        }
        String query = includeDeleted ? "userId = ?1 ORDER BY name" : "userId = ?1 AND deleted = false ORDER BY name";
        return list(query, userId);
    }

    public CustomCharacter findByIdAndUser(Long id, String userId) {
        if (id == null || userId == null || userId.isBlank()) {
            return null;
        }
        return find("id = ?1 AND userId = ?2", id, userId).firstResult();
    }

    public boolean belongsToUser(CustomCharacter character, String userId) {
        return character != null && userId != null && !userId.isBlank()
                && Objects.equals(character.getUserId(), userId);
    }
}
