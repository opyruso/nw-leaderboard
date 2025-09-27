package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.entity.Suggestion;
import com.opyruso.nwleaderboard.entity.SuggestionStatus;
import com.opyruso.nwleaderboard.repository.SuggestionRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Optional;

/**
 * Business service handling suggestion persistence and retrieval.
 */
@ApplicationScoped
public class SuggestionService {

    @Inject
    SuggestionRepository suggestionRepository;

    @Transactional
    public Suggestion createSuggestion(String author, String title, String content) {
        Suggestion suggestion = new Suggestion();
        suggestion.setAuthor(author);
        suggestion.setTitle(title);
        suggestion.setContent(content);
        suggestion.setStatus(SuggestionStatus.NEW);
        suggestionRepository.persist(suggestion);
        suggestionRepository.flush();
        return suggestion;
    }

    public List<Suggestion> listForAuthor(String author) {
        return suggestionRepository.listByAuthor(author);
    }

    public List<Suggestion> listAll() {
        return suggestionRepository.listAllOldestFirst();
    }

    @Transactional
    public Optional<Suggestion> updateStatus(Long id, SuggestionStatus status) {
        if (id == null || status == null) {
            return Optional.empty();
        }
        return suggestionRepository.findByIdOptional(id).map(entity -> {
            entity.setStatus(status);
            suggestionRepository.flush();
            return entity;
        });
    }
}
