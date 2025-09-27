package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Player;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Repository exposing player lookup helpers.
 */
@ApplicationScoped
public class PlayerRepository implements PanacheRepository<Player> {

    /**
     * Finds a player by name ignoring case and surrounding whitespace.
     *
     * @param rawName the player name provided by the client
     * @return the matching player if present
     */
    public Optional<Player> findByPlayerNameIgnoreCase(String rawName) {
        if (rawName == null) {
            return Optional.empty();
        }
        String trimmed = rawName.strip();
        if (trimmed.isEmpty()) {
            return Optional.empty();
        }
        String normalised = trimmed.toLowerCase(Locale.ROOT);
        return find("LOWER(playerName) = ?1", normalised).firstResultOptional();
    }

    /**
     * Searches for players whose name contains the provided query.
     *
     * @param rawQuery query string supplied by the client
     * @param limit maximum number of results to return (values &lt;= 0 fall back to a sensible default)
     * @return ordered list of matching players
     */
    public List<Player> searchByName(String rawQuery, int limit) {
        if (rawQuery == null) {
            return List.of();
        }
        String trimmed = rawQuery.strip();
        if (trimmed.isEmpty()) {
            return List.of();
        }

        int safeLimit = limit > 0 ? Math.min(limit, 50) : 10;
        String normalised = trimmed.toLowerCase(Locale.ROOT);
        String escaped = normalised
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        String pattern = "%" + escaped.replace(' ', '%') + "%";

        return new ArrayList<>(find("LOWER(playerName) LIKE ?1 ESCAPE '\\' ORDER BY LOWER(playerName) ASC", pattern)
                .range(0, safeLimit - 1)
                .list());
    }

    /**
     * Lists all players ordered alphabetically by name.
     *
     * @return ordered list of players
     */
    public List<Player> listAllOrderedByName() {
        return list("ORDER BY LOWER(playerName) ASC");
    }

    /**
     * Finds a player that is marked as a main character by name ignoring case and surrounding whitespace.
     *
     * @param rawName the player name provided by the client
     * @return the matching main player if present
     */
    public Optional<Player> findMainByPlayerNameIgnoreCase(String rawName) {
        return findByPlayerNameIgnoreCase(rawName).filter(player -> player != null && player.getMainCharacter() == null);
    }

    /**
     * Lists all players referencing the provided main player.
     *
     * @param mainPlayerId identifier of the main player
     * @return list of alternate characters
     */
    public List<Player> listByMainCharacterId(Long mainPlayerId) {
        if (mainPlayerId == null) {
            return List.of();
        }
        return list("mainCharacter.id", mainPlayerId);
    }

    /**
     * Counts the number of alternate characters referencing the provided main player.
     *
     * @param mainPlayerId identifier of the main player
     * @return number of linked alternate characters
     */
    public long countByMainCharacterId(Long mainPlayerId) {
        if (mainPlayerId == null) {
            return 0L;
        }
        return count("mainCharacter.id", mainPlayerId);
    }

    /**
     * Loads players matching the provided identifiers.
     *
     * @param ids identifiers to load
     * @return list of matching players
     */
    public List<Player> listByIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return list("id IN ?1", ids);
    }
}
