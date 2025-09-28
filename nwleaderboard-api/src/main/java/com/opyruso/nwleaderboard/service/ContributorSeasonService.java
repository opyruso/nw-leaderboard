package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributorSeasonCreateRequest;
import com.opyruso.nwleaderboard.dto.ContributorSeasonEntryResponse;
import com.opyruso.nwleaderboard.dto.ContributorSeasonUpdateRequest;
import com.opyruso.nwleaderboard.entity.Season;
import com.opyruso.nwleaderboard.repository.SeasonRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.PersistenceException;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response.Status;
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
        season.setDateBegin(dateBegin);
        season.setDateEnd(dateEnd);
        seasonRepository.persistAndFlush(season);
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
        if (request == null || (isBlank(request.dateBegin()) && isBlank(request.dateEnd()))) {
            throw new ContributorSeasonException("No updates were provided.", Status.BAD_REQUEST);
        }
        LocalDate currentBegin = season.getDateBegin();
        LocalDate currentEnd = season.getDateEnd();
        LocalDate nextBegin = isBlank(request.dateBegin()) ? currentBegin : parseRequiredDate(request.dateBegin(), "date_begin");
        LocalDate nextEnd = isBlank(request.dateEnd()) ? currentEnd : parseRequiredDate(request.dateEnd(), "date_end");
        if (nextBegin.isAfter(nextEnd)) {
            throw new ContributorSeasonException("date_begin must be before or equal to date_end.", Status.BAD_REQUEST);
        }
        season.setDateBegin(nextBegin);
        season.setDateEnd(nextEnd);
        return toResponse(season);
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
