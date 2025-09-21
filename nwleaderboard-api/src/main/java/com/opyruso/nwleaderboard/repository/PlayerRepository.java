package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Player;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
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
}
