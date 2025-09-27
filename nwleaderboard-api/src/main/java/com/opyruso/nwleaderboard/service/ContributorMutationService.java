package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributorMutationCreateRequest;
import com.opyruso.nwleaderboard.dto.ContributorMutationDungeonOption;
import com.opyruso.nwleaderboard.dto.ContributorMutationEntryResponse;
import com.opyruso.nwleaderboard.dto.ContributorMutationOptionsResponse;
import com.opyruso.nwleaderboard.dto.ContributorMutationUpdateRequest;
import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.entity.MutationCurse;
import com.opyruso.nwleaderboard.entity.MutationElement;
import com.opyruso.nwleaderboard.entity.MutationPromotion;
import com.opyruso.nwleaderboard.entity.MutationType;
import com.opyruso.nwleaderboard.entity.WeekMutationDungeon;
import com.opyruso.nwleaderboard.repository.DungeonRepository;
import com.opyruso.nwleaderboard.repository.MutationCurseRepository;
import com.opyruso.nwleaderboard.repository.MutationElementRepository;
import com.opyruso.nwleaderboard.repository.MutationPromotionRepository;
import com.opyruso.nwleaderboard.repository.MutationTypeRepository;
import com.opyruso.nwleaderboard.repository.WeekMutationDungeonRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response.Status;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Service exposing contributor-facing operations to manage weekly dungeon mutations.
 */
@ApplicationScoped
public class ContributorMutationService {

    @Inject
    WeekMutationDungeonRepository weekMutationDungeonRepository;

    @Inject
    DungeonRepository dungeonRepository;

    @Inject
    MutationElementRepository mutationElementRepository;

    @Inject
    MutationTypeRepository mutationTypeRepository;

    @Inject
    MutationPromotionRepository mutationPromotionRepository;

    @Inject
    MutationCurseRepository mutationCurseRepository;

    @Transactional
    public List<ContributorMutationEntryResponse> listMutations() {
        return weekMutationDungeonRepository.listAllWithRelations().stream()
                .filter(Objects::nonNull)
                .map(this::toResponse)
                .sorted(this::compareEntries)
                .collect(Collectors.toList());
    }

    @Transactional
    public ContributorMutationEntryResponse createMutation(ContributorMutationCreateRequest request)
            throws ContributorMutationException {
        int week = normaliseWeek(request != null ? request.week() : null);
        long dungeonId = normaliseDungeonId(request != null ? request.dungeonId() : null);
        String elementId = requireMutationCode(request != null ? request.mutationElementId() : null, "mutation_element_id");
        String typeId = requireMutationCode(request != null ? request.mutationTypeId() : null, "mutation_type_id");
        String promotionId = requireMutationCode(request != null ? request.mutationPromotionId() : null, "mutation_promotion_id");
        String curseId = requireMutationCode(request != null ? request.mutationCurseId() : null, "mutation_curse_id");

        if (weekMutationDungeonRepository.findByIds(week, dungeonId) != null) {
            throw new ContributorMutationException("A mutation already exists for this week and dungeon.", Status.CONFLICT);
        }

        Dungeon dungeon = dungeonRepository.findById(dungeonId);
        if (dungeon == null) {
            throw new ContributorMutationException("Dungeon not found.", Status.BAD_REQUEST);
        }

        MutationElement element = requireEnabledElement(elementId);
        MutationType type = requireEnabledType(typeId);
        MutationPromotion promotion = requireEnabledPromotion(promotionId);
        MutationCurse curse = requireEnabledCurse(curseId);

        WeekMutationDungeon entity = new WeekMutationDungeon();
        entity.setWeek(week);
        entity.setDungeon(dungeon);
        entity.setMutationElement(element);
        entity.setMutationType(type);
        entity.setMutationPromotion(promotion);
        entity.setMutationCurse(curse);

        weekMutationDungeonRepository.persist(entity);
        return toResponse(entity);
    }

    @Transactional
    public ContributorMutationEntryResponse updateMutation(Integer weekParam, Long dungeonParam, ContributorMutationUpdateRequest request)
            throws ContributorMutationException {
        int week = normaliseWeek(weekParam);
        long dungeonId = normaliseDungeonId(dungeonParam);
        WeekMutationDungeon entity = weekMutationDungeonRepository.findByIds(week, dungeonId);
        if (entity == null) {
            throw new ContributorMutationException("Mutation not found.", Status.NOT_FOUND);
        }
        boolean hasUpdates = false;
        if (request != null) {
            String elementId = normaliseMutationCode(request.mutationElementId());
            if (elementId != null) {
                entity.setMutationElement(requireEnabledElement(elementId));
                hasUpdates = true;
            }
            String typeId = normaliseMutationCode(request.mutationTypeId());
            if (typeId != null) {
                entity.setMutationType(requireEnabledType(typeId));
                hasUpdates = true;
            }
            String promotionId = normaliseMutationCode(request.mutationPromotionId());
            if (promotionId != null) {
                entity.setMutationPromotion(requireEnabledPromotion(promotionId));
                hasUpdates = true;
            }
            String curseId = normaliseMutationCode(request.mutationCurseId());
            if (curseId != null) {
                entity.setMutationCurse(requireEnabledCurse(curseId));
                hasUpdates = true;
            }
        }
        if (!hasUpdates) {
            throw new ContributorMutationException("No updates were provided.", Status.BAD_REQUEST);
        }
        return toResponse(entity);
    }

    @Transactional
    public void deleteMutation(Integer weekParam, Long dungeonParam) throws ContributorMutationException {
        int week = normaliseWeek(weekParam);
        long dungeonId = normaliseDungeonId(dungeonParam);
        WeekMutationDungeon entity = weekMutationDungeonRepository.findByIds(week, dungeonId);
        if (entity == null) {
            throw new ContributorMutationException("Mutation not found.", Status.NOT_FOUND);
        }
        weekMutationDungeonRepository.delete(entity);
    }

    @Transactional
    public ContributorMutationOptionsResponse listOptions() {
        List<ContributorMutationDungeonOption> dungeons = dungeonRepository.listAll().stream()
                .filter(Objects::nonNull)
                .map(this::toDungeonOption)
                .sorted(this::compareDungeonOptions)
                .collect(Collectors.toList());
        List<String> elements = mutationElementRepository.listEnabled().stream()
                .map(MutationElement::getId)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(Collectors.toList());
        List<String> types = mutationTypeRepository.listEnabled().stream()
                .map(MutationType::getId)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(Collectors.toList());
        List<String> promotions = mutationPromotionRepository.listEnabled().stream()
                .map(MutationPromotion::getId)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(Collectors.toList());
        List<String> curses = mutationCurseRepository.listEnabled().stream()
                .map(MutationCurse::getId)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(Collectors.toList());
        return new ContributorMutationOptionsResponse(dungeons, elements, types, promotions, curses);
    }

    private ContributorMutationEntryResponse toResponse(WeekMutationDungeon entity) {
        if (entity == null) {
            return new ContributorMutationEntryResponse(null, null, Map.of(), null, null, null, null);
        }
        Dungeon dungeon = entity.getDungeon();
        Map<String, String> dungeonNames = dungeon != null ? buildNameMap(dungeon) : Map.of();
        return new ContributorMutationEntryResponse(
                entity.getWeek(),
                dungeon != null ? dungeon.getId() : null,
                dungeonNames,
                entity.getMutationElement() != null ? entity.getMutationElement().getId() : null,
                entity.getMutationType() != null ? entity.getMutationType().getId() : null,
                entity.getMutationPromotion() != null ? entity.getMutationPromotion().getId() : null,
                entity.getMutationCurse() != null ? entity.getMutationCurse().getId() : null);
    }

    private ContributorMutationDungeonOption toDungeonOption(Dungeon dungeon) {
        if (dungeon == null) {
            return new ContributorMutationDungeonOption(null, Map.of());
        }
        return new ContributorMutationDungeonOption(dungeon.getId(), buildNameMap(dungeon));
    }

    private Map<String, String> buildNameMap(Dungeon dungeon) {
        LinkedHashMap<String, String> names = new LinkedHashMap<>();
        names.put("en", valueOrEmpty(dungeon.getNameLocalEn()));
        names.put("de", valueOrEmpty(dungeon.getNameLocalDe()));
        names.put("fr", valueOrEmpty(dungeon.getNameLocalFr()));
        names.put("es", valueOrEmpty(dungeon.getNameLocalEs()));
        names.put("esmx", valueOrEmpty(dungeon.getNameLocalEsmx()));
        names.put("it", valueOrEmpty(dungeon.getNameLocalIt()));
        names.put("pl", valueOrEmpty(dungeon.getNameLocalPl()));
        names.put("pt", valueOrEmpty(dungeon.getNameLocalPt()));
        return Map.copyOf(names);
    }

    private String valueOrEmpty(String value) {
        String trimmed = value == null ? null : value.strip();
        return trimmed == null ? "" : trimmed;
    }

    private int compareEntries(ContributorMutationEntryResponse left, ContributorMutationEntryResponse right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return 1;
        }
        if (right == null) {
            return -1;
        }
        int weekComparison = Integer.compare(right.week() != null ? right.week() : Integer.MIN_VALUE,
                left.week() != null ? left.week() : Integer.MIN_VALUE);
        if (weekComparison != 0) {
            return weekComparison;
        }
        String leftName = resolveDisplayName(left.dungeonNames());
        String rightName = resolveDisplayName(right.dungeonNames());
        return String.CASE_INSENSITIVE_ORDER.compare(rightName, leftName);
    }

    private int compareDungeonOptions(ContributorMutationDungeonOption left, ContributorMutationDungeonOption right) {
        String leftName = resolveDisplayName(left != null ? left.names() : Map.of());
        String rightName = resolveDisplayName(right != null ? right.names() : Map.of());
        return String.CASE_INSENSITIVE_ORDER.compare(leftName, rightName);
    }

    private String resolveDisplayName(Map<String, String> names) {
        if (names == null || names.isEmpty()) {
            return "";
        }
        for (String key : List.of("en", "fr", "de", "es", "esmx", "it", "pl", "pt")) {
            String value = names.get(key);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return names.values().stream().filter(name -> name != null && !name.isBlank()).findFirst().orElse("");
    }

    private int normaliseWeek(Integer week) throws ContributorMutationException {
        if (week == null || week <= 0) {
            throw new ContributorMutationException("Week must be a positive number.", Status.BAD_REQUEST);
        }
        return week;
    }

    private long normaliseDungeonId(Long dungeonId) throws ContributorMutationException {
        if (dungeonId == null || dungeonId <= 0) {
            throw new ContributorMutationException("Invalid dungeon identifier.", Status.BAD_REQUEST);
        }
        return dungeonId;
    }

    private String normaliseMutationCode(String code) {
        if (code == null) {
            return null;
        }
        String trimmed = code.strip();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String requireMutationCode(String code, String field) throws ContributorMutationException {
        String normalised = normaliseMutationCode(code);
        if (normalised == null) {
            throw new ContributorMutationException("Missing value for " + field + ".", Status.BAD_REQUEST);
        }
        return normalised;
    }

    private MutationElement requireEnabledElement(String elementId) throws ContributorMutationException {
        MutationElement element = mutationElementRepository.findById(elementId);
        if (element == null || !element.isEnable()) {
            throw new ContributorMutationException("Invalid mutation element.", Status.BAD_REQUEST);
        }
        return element;
    }

    private MutationType requireEnabledType(String typeId) throws ContributorMutationException {
        MutationType type = mutationTypeRepository.findById(typeId);
        if (type == null || !type.isEnable()) {
            throw new ContributorMutationException("Invalid mutation type.", Status.BAD_REQUEST);
        }
        return type;
    }

    private MutationPromotion requireEnabledPromotion(String promotionId) throws ContributorMutationException {
        MutationPromotion promotion = mutationPromotionRepository.findById(promotionId);
        if (promotion == null || !promotion.isEnable()) {
            throw new ContributorMutationException("Invalid mutation promotion.", Status.BAD_REQUEST);
        }
        return promotion;
    }

    private MutationCurse requireEnabledCurse(String curseId) throws ContributorMutationException {
        MutationCurse curse = mutationCurseRepository.findById(curseId);
        if (curse == null || !curse.isEnable()) {
            throw new ContributorMutationException("Invalid mutation curse.", Status.BAD_REQUEST);
        }
        return curse;
    }

    public static class ContributorMutationException extends Exception {

        private final Status status;

        public ContributorMutationException(String message, Status status) {
            super(message);
            this.status = status != null ? status : Status.BAD_REQUEST;
        }

        public Status status() {
            return status;
        }
    }
}
