package com.opyruso.nwleaderboard;

import com.opyruso.nwleaderboard.dto.DungeonResponse;
import com.opyruso.nwleaderboard.entity.Dungeon;
import com.opyruso.nwleaderboard.repository.DungeonRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import java.text.Collator;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * REST resource exposing dungeon metadata for the leaderboard pages.
 */
@Path("/dungeons")
@Produces(MediaType.APPLICATION_JSON)
public class DungeonResource {

    private static final Locale DEFAULT_LOCALE = Locale.ENGLISH;

    @Inject
    DungeonRepository dungeonRepository;

    @GET
    public List<DungeonResponse> list(@Context HttpHeaders headers) {
        List<Locale> acceptable = headers != null ? headers.getAcceptableLanguages() : List.of();
        Locale displayLocale = selectDisplayLocale(acceptable);
        Collator collator = Collator.getInstance(displayLocale);
        collator.setStrength(Collator.PRIMARY);

        return dungeonRepository.listAll().stream()
                .filter(Objects::nonNull)
                .map(dungeon -> new DungeonResponse(dungeon.getId(), resolveName(dungeon, acceptable, displayLocale)))
                .sorted(Comparator.comparing(DungeonResponse::name, collator))
                .toList();
    }

    private Locale selectDisplayLocale(List<Locale> acceptable) {
        if (acceptable != null) {
            for (Locale locale : acceptable) {
                if (isSupportedLocale(locale)) {
                    return locale;
                }
            }
        }
        return DEFAULT_LOCALE;
    }

    private boolean isSupportedLocale(Locale locale) {
        if (locale == null) {
            return false;
        }
        String language = locale.getLanguage();
        if (language == null || language.isBlank() || "*".equals(language)) {
            return false;
        }
        return switch (language) {
            case "en", "fr", "de", "es", "it", "pl", "pt" -> true;
            default -> false;
        };
    }

    private String resolveName(Dungeon dungeon, List<Locale> acceptable, Locale fallbackLocale) {
        if (acceptable != null) {
            for (Locale locale : acceptable) {
                String candidate = translate(dungeon, locale);
                if (candidate != null && !candidate.isBlank()) {
                    return candidate;
                }
            }
        }
        String fallback = translate(dungeon, fallbackLocale);
        if (fallback != null && !fallback.isBlank()) {
            return fallback;
        }
        String english = safeTrim(dungeon.getNameLocalEn());
        return english != null ? english : "";
    }

    private String translate(Dungeon dungeon, Locale locale) {
        if (locale == null) {
            return null;
        }
        String language = locale.getLanguage();
        if (language == null || language.isBlank() || "*".equals(language)) {
            return null;
        }
        return switch (language) {
            case "fr" -> safeTrim(dungeon.getNameLocalFr());
            case "de" -> safeTrim(dungeon.getNameLocalDe());
            case "es" -> {
                if ("MX".equalsIgnoreCase(locale.getCountry())) {
                    yield safeTrim(dungeon.getNameLocalEsmx());
                }
                yield safeTrim(dungeon.getNameLocalEs());
            }
            case "it" -> safeTrim(dungeon.getNameLocalIt());
            case "pl" -> safeTrim(dungeon.getNameLocalPl());
            case "pt" -> safeTrim(dungeon.getNameLocalPt());
            case "en" -> safeTrim(dungeon.getNameLocalEn());
            default -> null;
        };
    }

    private String safeTrim(String value) {
        return value == null ? null : value.strip();
    }
}
