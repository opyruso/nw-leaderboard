package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributorSeasonCreateRequest;
import com.opyruso.nwleaderboard.dto.ContributorSeasonEntryResponse;
import com.opyruso.nwleaderboard.dto.ContributorSeasonUpdateRequest;
import com.opyruso.nwleaderboard.entity.Season;
import com.opyruso.nwleaderboard.repository.SeasonRepository;
import com.opyruso.nwleaderboard.repository.WeekMutationDungeonRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response.Status;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Service exposing contributor operations to manage seasons.
 */
@ApplicationScoped
public class ContributorSeasonService {

    @Inject
    SeasonRepository seasonRepository;

    @Inject
    WeekMutationDungeonRepository weekMutationDungeonRepository;

    @Transactional
    public List<ContributorSeasonEntryResponse> listSeasons() {
        return seasonRepository.listAllOrderByDateBeginDesc().stream()
                .filter(Objects::nonNull)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ContributorSeasonEntryResponse createSeason(ContributorSeasonCreateRequest request)
            throws ContributorSeasonException {
        LocalDate dateBegin = parseRequiredDate(request != null ? request.dateBegin() : null, "date_begin");
        LocalDate dateEnd = parseRequiredDate(request != null ? request.dateEnd() : null, "date_end");
        if (dateBegin.isAfter(dateEnd)) {
            throw new ContributorSeasonException("date_begin must be before or equal to date_end.", Status.BAD_REQUEST);
        }
        Season season = new Season();
        Integer requestedId = normaliseOptionalSeasonId(request != null ? request.id() : null);
        if (requestedId == null) {
            requestedId = seasonRepository.findNextAvailableId();
        } else if (seasonRepository.existsById(requestedId)) {
            throw new ContributorSeasonException("Season identifier already exists.", Status.CONFLICT);
        }
        season.setId(requestedId);
        season.setDateBegin(dateBegin);
        season.setDateEnd(dateEnd);
        try {
            seasonRepository.persistAndFlush(season);
        } catch (PersistenceException e) {
            throw new ContributorSeasonException("Unable to create season.", Status.CONFLICT, e);
        }
        return toResponse(season);
    }

    @Transactional
    public ContributorSeasonEntryResponse updateSeason(Integer seasonId, ContributorSeasonUpdateRequest request)
            throws ContributorSeasonException {
        int id = normaliseSeasonId(seasonId);
        Season season = seasonRepository.findById(id);
        if (season == null) {
            throw new ContributorSeasonException("Season not found.", Status.NOT_FOUND);
        }
        if (request == null
                || (isBlank(request.dateBegin())
                        && isBlank(request.dateEnd())
                        && request.id() == null
                        && request.previousId() == null)) {
            throw new ContributorSeasonException("No updates were provided.", Status.BAD_REQUEST);
        }
        Integer providedPreviousId = normaliseOptionalSeasonId(request != null ? request.previousId() : null);
        if (providedPreviousId != null && providedPreviousId != id) {
            throw new ContributorSeasonException(
                    "previous_id does not match the targeted season.", Status.BAD_REQUEST);
        }
        LocalDate currentBegin = season.getDateBegin();
        LocalDate currentEnd = season.getDateEnd();
        LocalDate nextBegin =
                isBlank(request.dateBegin()) ? currentBegin : parseRequiredDate(request.dateBegin(), "date_begin");
        LocalDate nextEnd = isBlank(request.dateEnd()) ? currentEnd : parseRequiredDate(request.dateEnd(), "date_end");
        if (nextBegin.isAfter(nextEnd)) {
            throw new ContributorSeasonException("date_begin must be before or equal to date_end.", Status.BAD_REQUEST);
        }
        Integer requestedId = normaliseOptionalSeasonId(request.id());
        boolean updateIdentifier = requestedId != null && requestedId != id;
        if (updateIdentifier && seasonRepository.existsById(requestedId)) {
            throw new ContributorSeasonException(
                    "Another season already uses this identifier.", Status.CONFLICT);
        }
        if (!updateIdentifier) {
            season.setDateBegin(nextBegin);
            season.setDateEnd(nextEnd);
            return toResponse(season);
        }

        LocalDate originalBegin = season.getDateBegin();
        LocalDate originalEnd = season.getDateEnd();
        LocalDate placeholderDate = findTemporaryDate();
        season.setDateBegin(placeholderDate);
        season.setDateEnd(placeholderDate);
        try {
            seasonRepository.flush();
        } catch (PersistenceException e) {
            season.setDateBegin(originalBegin);
            season.setDateEnd(originalEnd);
            throw new ContributorSeasonException(
                    "Unable to update season identifier.", Status.CONFLICT, e);
        }

        Season replacement = new Season();
        replacement.setId(requestedId);
        replacement.setDateBegin(nextBegin);
        replacement.setDateEnd(nextEnd);
        try {
            seasonRepository.persistAndFlush(replacement);
        } catch (PersistenceException e) {
            season.setDateBegin(originalBegin);
            season.setDateEnd(originalEnd);
            try {
                seasonRepository.flush();
            } catch (PersistenceException ignored) {
                // ignore secondary failure while attempting to restore original dates
            }
            throw new ContributorSeasonException(
                    "Unable to update season identifier.", Status.CONFLICT, e);
        }

        weekMutationDungeonRepository.reassignSeason(season, replacement);
        seasonRepository.delete(season);
        seasonRepository.flush();
        return toResponse(replacement);
    }

    @Transactional
    public void deleteSeason(Integer seasonId) throws ContributorSeasonException {
        int id = normaliseSeasonId(seasonId);
        Season season = seasonRepository.findById(id);
        if (season == null) {
            throw new ContributorSeasonException("Season not found.", Status.NOT_FOUND);
        }
        try {
            seasonRepository.delete(season);
            seasonRepository.flush();
        } catch (PersistenceException e) {
            throw new ContributorSeasonException(
                    "Unable to delete season because it is referenced by existing data.",
                    Status.CONFLICT,
                    e);
        }
    }

    private ContributorSeasonEntryResponse toResponse(Season season) {
        if (season == null) {
            return new ContributorSeasonEntryResponse(null, null, null);
        }
        return new ContributorSeasonEntryResponse(season.getId(), season.getDateBegin(), season.getDateEnd());
    }

    private int normaliseSeasonId(Integer seasonId) throws ContributorSeasonException {
        if (seasonId == null || seasonId <= 0) {
            throw new ContributorSeasonException("Invalid season identifier.", Status.BAD_REQUEST);
        }
        return seasonId;
    }

    private Integer normaliseOptionalSeasonId(Integer seasonId) throws ContributorSeasonException {
        if (seasonId == null) {
            return null;
        }
        return normaliseSeasonId(seasonId);
    }

    private LocalDate parseRequiredDate(String value, String field) throws ContributorSeasonException {
        if (isBlank(value)) {
            throw new ContributorSeasonException("Missing value for " + field + ".", Status.BAD_REQUEST);
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new ContributorSeasonException(
                    "Invalid value for " + field + " (expected yyyy-MM-dd).",
                    Status.BAD_REQUEST,
                    e);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private LocalDate findTemporaryDate() throws ContributorSeasonException {
        LocalDate candidate = searchAvailableDate(LocalDate.of(9999, 12, 31), -1);
        if (candidate != null) {
            return candidate;
        }
        candidate = searchAvailableDate(LocalDate.of(1900, 1, 1), 1);
        if (candidate != null) {
            return candidate;
        }
        candidate = searchAvailableDate(LocalDate.now(), 1);
        if (candidate != null) {
            return candidate;
        }
        throw new ContributorSeasonException("Unable to update season identifier.", Status.CONFLICT);
    }

    private LocalDate searchAvailableDate(LocalDate start, int step) {
        LocalDate candidate = start;
        for (int attempts = 0; attempts < 1000; attempts++) {
            if (!dateInUse(candidate, candidate)) {
                return candidate;
            }
            try {
                candidate = candidate.plusDays(step);
            } catch (DateTimeException ignored) {
                return null;
            }
        }
        return null;
    }

    private boolean dateInUse(LocalDate begin, LocalDate end) {
        return seasonRepository.existsByDateBegin(begin)
                || seasonRepository.existsByDateEnd(end)
                || seasonRepository.existsByDateRange(begin, end);
    }

    public static class ContributorSeasonException extends Exception {

        private final Status status;

        public ContributorSeasonException(String message, Status status) {
            super(message);
            this.status = status != null ? status : Status.BAD_REQUEST;
        }

        public ContributorSeasonException(String message, Status status, Throwable cause) {
            super(message, cause);
            this.status = status != null ? status : Status.BAD_REQUEST;
        }

        public Status status() {
            return status;
        }
    }
}
