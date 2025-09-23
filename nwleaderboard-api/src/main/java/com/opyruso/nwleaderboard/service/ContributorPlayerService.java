package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import com.opyruso.nwleaderboard.entity.RunScorePlayerId;
import com.opyruso.nwleaderboard.entity.RunTimePlayer;
import com.opyruso.nwleaderboard.entity.RunTimePlayerId;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScorePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunTimePlayerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service exposing player management operations for contributors.
 */
@ApplicationScoped
public class ContributorPlayerService {

    @Inject
    PlayerRepository playerRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Inject
    RunTimePlayerRepository runTimePlayerRepository;

    /**
     * Lists all players ordered alphabetically by name.
     *
     * @return ordered list of players
     */
    @Transactional
    public List<PlayerWithRuns> listPlayers() {
        List<Player> players = playerRepository.listAllOrderedByName();
        return attachRunCounts(players);
    }

    /**
     * Updates the validity flag for a player.
     *
     * @param playerId identifier of the player
     * @param valid desired validity state
     * @return updated player entity
     */
    @Transactional
    public PlayerWithRuns updateValidity(Long playerId, boolean valid) {
        Player player = requirePlayer(playerId);
        player.setValid(valid);
        return buildSummary(player);
    }

    /**
     * Renames a player or merges it into an existing entry when a duplicate name is used.
     *
     * @param playerId identifier of the player to rename
     * @param rawName desired player name
     * @return rename outcome containing the resulting player and optional removed identifier
     */
    @Transactional
    public RenameResult renamePlayer(Long playerId, String rawName) {
        Player player = requirePlayer(playerId);
        String cleaned = normaliseName(rawName);
        if (cleaned == null || cleaned.isBlank()) {
            throw new ContributorPlayerException("Player name is required");
        }

        if (player.getPlayerName() != null && player.getPlayerName().equalsIgnoreCase(cleaned)) {
            player.setPlayerName(cleaned);
            return new RenameResult(buildSummary(player), null);
        }

        Optional<Player> duplicate = playerRepository.findByPlayerNameIgnoreCase(cleaned);
        if (duplicate.isPresent()) {
            Player target = duplicate.get();
            if (Objects.equals(target.getId(), player.getId())) {
                player.setPlayerName(cleaned);
                return new RenameResult(buildSummary(player), null);
            }
            mergePlayers(player, target);
            return new RenameResult(buildSummary(target), player.getId());
        }

        player.setPlayerName(cleaned);
        return new RenameResult(buildSummary(player), null);
    }

    private void mergePlayers(Player source, Player target) {
        mergeScoreAssociations(source, target);
        mergeTimeAssociations(source, target);
        playerRepository.delete(source);
        playerRepository.flush();
    }

    private List<PlayerWithRuns> attachRunCounts(List<Player> players) {
        if (players == null || players.isEmpty()) {
            return List.of();
        }
        List<Long> ids = players.stream()
                .map(Player::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        Map<Long, Long> scoreCounts = runScorePlayerRepository.countByPlayerIds(ids);
        Map<Long, Long> timeCounts = runTimePlayerRepository.countByPlayerIds(ids);
        return players.stream()
                .map(player -> {
                    long scoreRuns = scoreCounts.getOrDefault(player.getId(), 0L);
                    long timeRuns = timeCounts.getOrDefault(player.getId(), 0L);
                    return new PlayerWithRuns(player, scoreRuns, timeRuns);
                })
                .collect(Collectors.toList());
    }

    private PlayerWithRuns buildSummary(Player player) {
        if (player == null) {
            throw new ContributorPlayerException("Player not found");
        }
        long scoreRuns = runScorePlayerRepository.countByPlayerId(player.getId());
        long timeRuns = runTimePlayerRepository.countByPlayerId(player.getId());
        return new PlayerWithRuns(player, scoreRuns, timeRuns);
    }

    private void mergeScoreAssociations(Player source, Player target) {
        List<RunScorePlayer> sourceAssociations = runScorePlayerRepository.listByPlayerId(source.getId());
        if (sourceAssociations.isEmpty()) {
            return;
        }
        Set<Long> targetRunIds = new HashSet<>(runScorePlayerRepository.listRunIdsByPlayer(target.getId()));
        for (RunScorePlayer association : sourceAssociations) {
            if (association.getRunScore() == null || association.getRunScore().getId() == null) {
                continue;
            }
            Long runId = association.getRunScore().getId();
            if (targetRunIds.contains(runId)) {
                runScorePlayerRepository.delete(association);
                continue;
            }
            RunScorePlayer replacement = new RunScorePlayer();
            replacement.setRunScore(association.getRunScore());
            replacement.setPlayer(target);
            replacement.setId(new RunScorePlayerId(runId, target.getId()));
            runScorePlayerRepository.persist(replacement);
            runScorePlayerRepository.delete(association);
            targetRunIds.add(runId);
        }
    }

    private void mergeTimeAssociations(Player source, Player target) {
        List<RunTimePlayer> sourceAssociations = runTimePlayerRepository.listByPlayerId(source.getId());
        if (sourceAssociations.isEmpty()) {
            return;
        }
        Set<Long> targetRunIds = new HashSet<>(runTimePlayerRepository.listRunIdsByPlayer(target.getId()));
        for (RunTimePlayer association : sourceAssociations) {
            if (association.getRunTime() == null || association.getRunTime().getId() == null) {
                continue;
            }
            Long runId = association.getRunTime().getId();
            if (targetRunIds.contains(runId)) {
                runTimePlayerRepository.delete(association);
                continue;
            }
            RunTimePlayer replacement = new RunTimePlayer();
            replacement.setRunTime(association.getRunTime());
            replacement.setPlayer(target);
            replacement.setId(new RunTimePlayerId(runId, target.getId()));
            runTimePlayerRepository.persist(replacement);
            runTimePlayerRepository.delete(association);
            targetRunIds.add(runId);
        }
    }

    private Player requirePlayer(Long playerId) {
        Player player = playerRepository.findById(playerId);
        if (player == null) {
            throw new ContributorPlayerException("Player not found");
        }
        return player;
    }

    private String normaliseName(String input) {
        if (input == null) {
            return null;
        }
        String trimmed = input.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Exception thrown when contributor player operations fail.
     */
    public static class ContributorPlayerException extends RuntimeException {

        private static final long serialVersionUID = 1L;

        public ContributorPlayerException(String message) {
            super(message);
        }
    }

    /**
     * Result of a rename operation.
     *
     * @param player resulting player entity
     * @param removedPlayerId identifier of the removed player when a merge occurred
     */
    public record PlayerWithRuns(Player player, long scoreRunCount, long timeRunCount) {}

    public record RenameResult(PlayerWithRuns player, Long removedPlayerId) {}
}
