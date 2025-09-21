package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Repository exposing read operations for {@link RunScorePlayer} entities.
 */
@ApplicationScoped
public class RunScorePlayerRepository implements PanacheRepository<RunScorePlayer> {

    /**
     * Retrieves the ordered mapping of run identifiers to participant names.
     *
     * @param runIds identifiers of the runs to fetch
     * @return map keyed by run identifier with the ordered list of participant names
     */
    public Map<Long, List<String>> findPlayerNamesByRunIds(List<Long> runIds) {
        if (runIds == null || runIds.isEmpty()) {
            return Map.of();
        }

        List<RunScorePlayer> associations = find(
                        "runScore.id in ?1 ORDER BY runScore.id ASC, player.playerName ASC",
                        runIds)
                .list();

        LinkedHashMap<Long, List<String>> namesByRun = new LinkedHashMap<>();
        for (RunScorePlayer association : associations) {
            if (association == null || association.getRunScore() == null) {
                continue;
            }
            Long runId = association.getRunScore().getId();
            if (runId == null) {
                continue;
            }
            String playerName = extractPlayerName(association);
            if (playerName == null) {
                continue;
            }
            namesByRun.computeIfAbsent(runId, ignored -> new java.util.ArrayList<>()).add(playerName);
        }

        namesByRun.replaceAll((id, names) -> List.copyOf(names));
        return Collections.unmodifiableMap(namesByRun);
    }

    private String extractPlayerName(RunScorePlayer association) {
        if (association.getPlayer() == null) {
            return null;
        }
        String name = association.getPlayer().getPlayerName();
        if (name == null) {
            return null;
        }
        String trimmed = name.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
