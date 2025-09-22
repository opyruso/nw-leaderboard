package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributionPlayerDto;
import com.opyruso.nwleaderboard.dto.ContributionRunDto;
import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.entity.Player;
import com.opyruso.nwleaderboard.entity.RunScore;
import com.opyruso.nwleaderboard.entity.RunScorePlayer;
import com.opyruso.nwleaderboard.entity.RunScorePlayerId;
import com.opyruso.nwleaderboard.entity.RunTime;
import com.opyruso.nwleaderboard.entity.RunTimePlayer;
import com.opyruso.nwleaderboard.entity.RunTimePlayerId;
import com.opyruso.nwleaderboard.repository.DungeonRepository;
import com.opyruso.nwleaderboard.repository.PlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScorePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunScoreRepository;
import com.opyruso.nwleaderboard.repository.RunTimePlayerRepository;
import com.opyruso.nwleaderboard.repository.RunTimeRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Handles validation and persistence of contributor submissions once the extracted data has been reviewed by the user.
 */
@ApplicationScoped
public class ContributorSubmissionService {

    @Inject
    DungeonRepository dungeonRepository;

    @Inject
    PlayerRepository playerRepository;

    @Inject
    RunScoreRepository runScoreRepository;

    @Inject
    RunScorePlayerRepository runScorePlayerRepository;

    @Inject
    RunTimeRepository runTimeRepository;

    @Inject
    RunTimePlayerRepository runTimePlayerRepository;

    /**
     * Persists the provided runs in a single transaction.
     *
     * @param payload list of runs submitted by the contributor
     * @throws ContributorSubmissionException if validation fails or referenced entities are missing
     */
    @Transactional
    public void persistRuns(List<ContributionRunDto> payload) throws ContributorSubmissionException {
        if (payload == null || payload.isEmpty()) {
            throw new ContributorSubmissionException("No runs provided");
        }

        for (ContributionRunDto dto : payload) {
            storeRun(dto);
        }
    }

    private void storeRun(ContributionRunDto dto) throws ContributorSubmissionException {
        if (dto == null) {
            return;
        }

        Integer week = dto.week();
        if (week == null || week <= 0) {
            throw new ContributorSubmissionException("Week must be a positive integer");
        }

        Long dungeonId = dto.dungeonId();
        if (dungeonId == null) {
            throw new ContributorSubmissionException("Dungeon identifier is required");
        }

        Dungeon dungeon = dungeonRepository.findById(dungeonId);
        if (dungeon == null) {
            throw new ContributorSubmissionException("Unknown dungeon with id " + dungeonId);
        }

        Integer expectedPlayerCount = dto.expectedPlayerCount();
        if (expectedPlayerCount == null || expectedPlayerCount <= 0) {
            throw new ContributorSubmissionException("Expected player count must be a positive integer");
        }
        Integer configuredCount = dungeon.getPlayerCount();
        if (configuredCount != null && configuredCount > 0 && !configuredCount.equals(expectedPlayerCount)) {
            throw new ContributorSubmissionException("Player count does not match dungeon configuration");
        }

        Integer score = dto.score();
        Integer time = dto.time();

        if ((score == null || score <= 0) && (time == null || time <= 0)) {
            throw new ContributorSubmissionException("Each run must contain either a positive score or time");
        }

        List<ContributionPlayerDto> players = normalisePlayers(dto.players());
        if (players.isEmpty()) {
            throw new ContributorSubmissionException("At least one player is required for each run");
        }

        if (players.size() != expectedPlayerCount) {
            throw new ContributorSubmissionException(
                    "Run contains " + players.size() + " players but expected " + expectedPlayerCount);
        }

        List<Player> resolvedPlayers = resolvePlayers(players);

        if (score != null && score > 0) {
            if (scoreRunAlreadyExists(week, dungeon, score, resolvedPlayers)) {
                throw new ContributorSubmissionException("Duplicate score run detected");
            }
            persistScoreRun(week, dungeon, score, resolvedPlayers);
        } else if (time != null && time > 0) {
            if (timeRunAlreadyExists(week, dungeon, time, resolvedPlayers)) {
                throw new ContributorSubmissionException("Duplicate time run detected");
            }
            persistTimeRun(week, dungeon, time, resolvedPlayers);
        } else {
            throw new ContributorSubmissionException("Run data is incomplete");
        }
    }

    private List<ContributionPlayerDto> normalisePlayers(List<ContributionPlayerDto> players) {
        if (players == null) {
            return List.of();
        }
        List<ContributionPlayerDto> cleaned = new ArrayList<>();
        for (ContributionPlayerDto player : players) {
            if (player == null) {
                continue;
            }
            String name = normalisePlayerName(player.playerName());
            if (name == null) {
                continue;
            }
            cleaned.add(new ContributionPlayerDto(name, player.playerId()));
        }
        return cleaned;
    }

    private String normalisePlayerName(String name) {
        if (name == null) {
            return null;
        }
        String cleaned = name.replaceAll("[\\r\\n]", " ").replaceAll("\\s+", " ").strip();
        return cleaned.isEmpty() ? null : cleaned;
    }

    private List<Player> resolvePlayers(List<ContributionPlayerDto> players) throws ContributorSubmissionException {
        List<Player> resolved = new ArrayList<>(players.size());
        for (ContributionPlayerDto dto : players) {
            resolved.add(resolvePlayer(dto));
        }
        return resolved;
    }

    private boolean scoreRunAlreadyExists(Integer week, Dungeon dungeon, Integer score, List<Player> players) {
        if (week == null || dungeon == null || score == null || players == null || players.isEmpty()) {
            return false;
        }

        List<RunScore> candidates = runScoreRepository.listByDungeonWeekAndScore(dungeon.getId(), week, score);
        if (candidates.isEmpty()) {
            return false;
        }

        Set<Long> expectedPlayerIds = players.stream().map(Player::getId).collect(Collectors.toSet());
        if (expectedPlayerIds.contains(null) || expectedPlayerIds.size() != players.size()) {
            return false;
        }

        List<Long> runIds = candidates.stream()
                .map(RunScore::getId)
                .filter(id -> id != null)
                .collect(Collectors.toList());
        if (runIds.isEmpty()) {
            return false;
        }

        Map<Long, List<RunScorePlayer>> associations = runScorePlayerRepository.listWithPlayersByRunIds(runIds).stream()
                .collect(Collectors.groupingBy(rsp -> rsp.getRunScore().getId()));

        for (Long runId : runIds) {
            List<RunScorePlayer> links = associations.get(runId);
            if (links == null || links.size() != expectedPlayerIds.size()) {
                continue;
            }

            Set<Long> candidatePlayerIds = links.stream()
                    .map(link -> link.getPlayer() != null ? link.getPlayer().getId() : null)
                    .collect(Collectors.toSet());
            if (!candidatePlayerIds.contains(null) && candidatePlayerIds.equals(expectedPlayerIds)) {
                return true;
            }
        }

        return false;
    }

    private boolean timeRunAlreadyExists(Integer week, Dungeon dungeon, Integer time, List<Player> players) {
        if (week == null || dungeon == null || time == null || players == null || players.isEmpty()) {
            return false;
        }

        List<RunTime> candidates = runTimeRepository.listByDungeonWeekAndTime(dungeon.getId(), week, time);
        if (candidates.isEmpty()) {
            return false;
        }

        Set<Long> expectedPlayerIds = players.stream().map(Player::getId).collect(Collectors.toSet());
        if (expectedPlayerIds.contains(null) || expectedPlayerIds.size() != players.size()) {
            return false;
        }

        List<Long> runIds = candidates.stream()
                .map(RunTime::getId)
                .filter(id -> id != null)
                .collect(Collectors.toList());
        if (runIds.isEmpty()) {
            return false;
        }

        Map<Long, List<RunTimePlayer>> associations = runTimePlayerRepository.listWithPlayersByRunIds(runIds).stream()
                .collect(Collectors.groupingBy(rtp -> rtp.getRunTime().getId()));

        for (Long runId : runIds) {
            List<RunTimePlayer> links = associations.get(runId);
            if (links == null || links.size() != expectedPlayerIds.size()) {
                continue;
            }

            Set<Long> candidatePlayerIds = links.stream()
                    .map(link -> link.getPlayer() != null ? link.getPlayer().getId() : null)
                    .collect(Collectors.toSet());
            if (!candidatePlayerIds.contains(null) && candidatePlayerIds.equals(expectedPlayerIds)) {
                return true;
            }
        }

        return false;
    }

    private void persistScoreRun(Integer week, Dungeon dungeon, Integer score, List<Player> players)
            throws ContributorSubmissionException {
        RunScore run = new RunScore();
        run.setWeek(week);
        run.setDungeon(dungeon);
        run.setScore(score);
        runScoreRepository.persistAndFlush(run);

        for (Player player : players) {
            RunScorePlayer association = new RunScorePlayer();
            association.setRunScore(run);
            association.setPlayer(player);
            association.setId(new RunScorePlayerId(run.getId(), player.getId()));
            runScorePlayerRepository.persist(association);
        }
    }

    private void persistTimeRun(Integer week, Dungeon dungeon, Integer time, List<Player> players)
            throws ContributorSubmissionException {
        RunTime run = new RunTime();
        run.setWeek(week);
        run.setDungeon(dungeon);
        run.setTimeInSecond(time);
        runTimeRepository.persistAndFlush(run);

        for (Player player : players) {
            RunTimePlayer association = new RunTimePlayer();
            association.setRunTime(run);
            association.setPlayer(player);
            association.setId(new RunTimePlayerId(run.getId(), player.getId()));
            runTimePlayerRepository.persist(association);
        }
    }

    private Player resolvePlayer(ContributionPlayerDto dto) throws ContributorSubmissionException {
        if (dto == null) {
            throw new ContributorSubmissionException("Missing player information");
        }

        Long playerId = dto.playerId();
        String name = normalisePlayerName(dto.playerName());
        if (playerId != null) {
            Player existing = playerRepository.findById(playerId);
            if (existing == null) {
                throw new ContributorSubmissionException("Unknown player id " + playerId);
            }
            if (name != null && !existing.getPlayerName().equalsIgnoreCase(name)) {
                existing.setPlayerName(name);
            }
            return existing;
        }

        if (name == null) {
            throw new ContributorSubmissionException("Player name is required");
        }

        Optional<Player> existing = playerRepository.findByPlayerNameIgnoreCase(name);
        if (existing.isPresent()) {
            return existing.get();
        }

        Player player = new Player();
        player.setPlayerName(name);
        playerRepository.persistAndFlush(player);
        return player;
    }

    /**
     * Exception raised when the contributor submission cannot be stored.
     */
    public static class ContributorSubmissionException extends Exception {

        private static final long serialVersionUID = 1L;

        public ContributorSubmissionException(String message) {
            super(message);
        }

        public ContributorSubmissionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
