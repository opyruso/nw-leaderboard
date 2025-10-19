package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.CustomCharacterOverviewResponse;
import com.opyruso.nwleaderboard.dto.CustomCharacterWeekResponse;
import com.opyruso.nwleaderboard.entity.CustomCharacter;
import com.opyruso.nwleaderboard.entity.CustomCharacterLimits;
import com.opyruso.nwleaderboard.entity.CustomCharacterLimitsId;
import com.opyruso.nwleaderboard.repository.CustomCharacterLimitsRepository;
import com.opyruso.nwleaderboard.repository.CustomCharacterRepository;
import com.opyruso.nwleaderboard.repository.WeekMutationDungeonRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service handling business logic around custom characters and their weekly limits.
 */
@ApplicationScoped
public class CustomCharacterService {

    private static final int MAX_UMBRALS = 4000;
    private static final int MAX_ACTIVITY_COUNT = 2;

    @Inject
    CustomCharacterRepository customCharacterRepository;

    @Inject
    CustomCharacterLimitsRepository customCharacterLimitsRepository;

    @Inject
    WeekMutationDungeonRepository weekMutationDungeonRepository;

    @Transactional
    public CustomCharacter createCharacter(String userId, String name) {
        String trimmedUserId = normalise(userId);
        if (trimmedUserId.isEmpty()) {
            throw new IllegalArgumentException("User identifier is required");
        }
        String trimmedName = normalise(name);
        if (trimmedName.isEmpty()) {
            throw new IllegalArgumentException("Character name is required");
        }
        CustomCharacter entity = new CustomCharacter();
        entity.setUserId(trimmedUserId);
        entity.setName(trimmedName);
        entity.setDeleted(false);
        customCharacterRepository.persist(entity);
        return entity;
    }

    public CustomCharacterOverviewResponse listCharacters(String userId, Integer week, boolean includeDeleted) {
        String trimmedUserId = normalise(userId);
        if (trimmedUserId.isEmpty()) {
            throw new IllegalArgumentException("User identifier is required");
        }

        List<Integer> weeks = weekMutationDungeonRepository.listDistinctWeeksDescending();
        Integer currentWeek = weeks.isEmpty() ? null : weeks.get(0);
        Integer effectiveWeek = week != null ? week : currentWeek;

        List<CustomCharacter> characters = customCharacterRepository.listByUserId(trimmedUserId, includeDeleted);
        List<Long> ids = characters.stream()
                .map(CustomCharacter::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        Map<Long, CustomCharacterLimits> limitsByCharacter;
        if (effectiveWeek != null && !ids.isEmpty()) {
            limitsByCharacter = customCharacterLimitsRepository.listByCharacterIdsAndWeek(ids, effectiveWeek).stream()
                    .filter(limit -> limit.getCustomCharacter() != null && limit.getCustomCharacter().getId() != null)
                    .collect(Collectors.toMap(limit -> limit.getCustomCharacter().getId(), Function.identity()));
        } else {
            limitsByCharacter = Collections.emptyMap();
        }

        List<CustomCharacterWeekResponse> responses = new ArrayList<>(characters.size());
        for (CustomCharacter character : characters) {
            CustomCharacterLimits limits = character != null && character.getId() != null
                    ? limitsByCharacter.get(character.getId())
                    : null;
            int umbrals = limits != null && limits.getWeekUmbralsCap() != null ? limits.getWeekUmbralsCap() : 0;
            int winter = limits != null && limits.getWeekWinterLimit() != null ? limits.getWeekWinterLimit() : 0;
            int hatchery = limits != null && limits.getWeekHatcheryLimit() != null ? limits.getWeekHatcheryLimit() : 0;
            responses.add(new CustomCharacterWeekResponse(
                    character.getId(),
                    character.getName(),
                    character.isDeleted(),
                    umbrals,
                    winter,
                    hatchery));
        }

        return new CustomCharacterOverviewResponse(currentWeek, effectiveWeek, List.copyOf(weeks), responses);
    }

    @Transactional
    public Optional<CustomCharacter> renameCharacter(Long id, String userId, String name) {
        CustomCharacter character = customCharacterRepository.findByIdAndUser(id, normalise(userId));
        if (character == null) {
            return Optional.empty();
        }
        String trimmedName = normalise(name);
        if (trimmedName.isEmpty()) {
            throw new IllegalArgumentException("Character name is required");
        }
        character.setName(trimmedName);
        return Optional.of(character);
    }

    @Transactional
    public Optional<CustomCharacterLimits> updateWeeklyLimits(
            Long id, String userId, Integer week, int weekUmbralsCap, int weekWinterLimit, int weekHatcheryLimit) {
        String trimmedUserId = normalise(userId);
        if (week == null) {
            return Optional.empty();
        }
        CustomCharacter character = customCharacterRepository.findByIdAndUser(id, trimmedUserId);
        if (character == null) {
            return Optional.empty();
        }

        int safeUmbrals = clamp(weekUmbralsCap, 0, MAX_UMBRALS);
        int safeWinter = clamp(weekWinterLimit, 0, MAX_ACTIVITY_COUNT);
        int safeHatchery = clamp(weekHatcheryLimit, 0, MAX_ACTIVITY_COUNT);

        CustomCharacterLimitsId limitsId = new CustomCharacterLimitsId(character.getId(), week);
        CustomCharacterLimits limits = customCharacterLimitsRepository.findById(limitsId);
        if (limits == null) {
            limits = new CustomCharacterLimits();
            limits.setCustomCharacter(character);
            limits.setWeek(week);
        }
        limits.setWeekUmbralsCap(safeUmbrals);
        limits.setWeekWinterLimit(safeWinter);
        limits.setWeekHatcheryLimit(safeHatchery);
        if (!customCharacterLimitsRepository.isPersistent(limits)) {
            customCharacterLimitsRepository.persist(limits);
        }
        return Optional.of(limits);
    }

    @Transactional
    public Optional<CustomCharacter> updateDeletionStatus(Long id, String userId, boolean deleted) {
        CustomCharacter character = customCharacterRepository.findByIdAndUser(id, normalise(userId));
        if (character == null) {
            return Optional.empty();
        }
        character.setDeleted(deleted);
        return Optional.of(character);
    }

    private static String normalise(String value) {
        return value != null ? value.trim() : "";
    }

    private static int clamp(int value, int min, int max) {
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    }
}
