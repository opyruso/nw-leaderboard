package com.opyruso.nwleaderboard.repository;

import com.opyruso.nwleaderboard.entity.Suggestion;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

/**
 * Repository handling persistence for {@link Suggestion} entities.
 */
@ApplicationScoped
public class SuggestionRepository implements PanacheRepository<Suggestion> {

    public List<Suggestion> listByAuthor(String author) {
        return list("author", Sort.by("creationDate").descending(), author);
    }

    public List<Suggestion> listAllOldestFirst() {
        return list("order by creationDate asc");
    }
}
