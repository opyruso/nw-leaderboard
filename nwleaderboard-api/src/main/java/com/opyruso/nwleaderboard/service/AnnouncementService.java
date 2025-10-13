package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.entity.Announcement;
import com.opyruso.nwleaderboard.repository.AnnouncementRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Business service handling administrative announcements.
 */
@ApplicationScoped
public class AnnouncementService {

    private static final LocalDateTime FAR_FUTURE_START = LocalDateTime.of(2999, 1, 1, 0, 0, 0);
    private static final LocalDateTime FAR_FUTURE_END = LocalDateTime.of(2999, 1, 1, 0, 0, 1);

    @Inject
    AnnouncementRepository announcementRepository;

    @Transactional
    public Announcement createDefaultAnnouncement() {
        Announcement announcement = new Announcement();
        announcement.setTitle("<TITRE>");
        announcement.setContentEn("<CONTENT>");
        announcement.setContentDe("<CONTENT>");
        announcement.setContentFr("<CONTENT>");
        announcement.setContentEs("<CONTENT>");
        announcement.setContentEsmx("<CONTENT>");
        announcement.setContentIt("<CONTENT>");
        announcement.setContentPl("<CONTENT>");
        announcement.setContentPt("<CONTENT>");
        announcement.setStartDate(FAR_FUTURE_START);
        announcement.setEndDate(FAR_FUTURE_END);
        announcementRepository.persist(announcement);
        announcementRepository.flush();
        return announcement;
    }

    public List<Announcement> listActiveAnnouncements() {
        return announcementRepository.listActive(LocalDateTime.now());
    }

    public List<Announcement> listAllAnnouncements() {
        return announcementRepository.listAllByStartDateDesc();
    }

    @Transactional
    public Optional<Announcement> updateAnnouncement(Long id, Announcement updatedValues) {
        if (id == null || updatedValues == null) {
            return Optional.empty();
        }
        return announcementRepository.findByIdOptional(id).map(entity -> {
            entity.setTitle(updatedValues.getTitle());
            entity.setContentEn(updatedValues.getContentEn());
            entity.setContentDe(updatedValues.getContentDe());
            entity.setContentFr(updatedValues.getContentFr());
            entity.setContentEs(updatedValues.getContentEs());
            entity.setContentEsmx(updatedValues.getContentEsmx());
            entity.setContentIt(updatedValues.getContentIt());
            entity.setContentPl(updatedValues.getContentPl());
            entity.setContentPt(updatedValues.getContentPt());
            entity.setStartDate(updatedValues.getStartDate());
            entity.setEndDate(updatedValues.getEndDate());
            announcementRepository.flush();
            return entity;
        });
    }

    @Transactional
    public boolean deleteAnnouncement(Long id) {
        if (id == null) {
            return false;
        }
        return announcementRepository.deleteById(id);
    }
}
