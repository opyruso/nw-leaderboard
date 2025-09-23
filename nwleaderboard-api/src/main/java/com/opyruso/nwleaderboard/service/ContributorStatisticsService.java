package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributorWeeklyRunsResponse;
import com.opyruso.nwleaderboard.repository.RunScoreRepository;
import com.opyruso.nwleaderboard.repository.RunTimeRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Provides aggregated statistics about runs submitted by contributors.
 */
@ApplicationScoped
public class ContributorStatisticsService {

    @Inject
    RunScoreRepository runScoreRepository;

    @Inject
    RunTimeRepository runTimeRepository;

    /**
     * Returns the number of score and time runs recorded for each week.
     *
     * @return list of weekly summaries sorted by week in descending order
     */
    public List<ContributorWeeklyRunsResponse> listRunsByWeek() {
        int highestWeek = Math.max(
                safeWeek(runScoreRepository.findHighestWeek()), safeWeek(runTimeRepository.findHighestWeek()));

        if (highestWeek <= 0) {
            return List.of();
        }

        Map<Integer, Long> scoreRuns = new HashMap<>(runScoreRepository.countRunsGroupedByWeek());
        Map<Integer, Long> timeRuns = new HashMap<>(runTimeRepository.countRunsGroupedByWeek());

        List<ContributorWeeklyRunsResponse> summaries = new ArrayList<>(highestWeek);
        for (int week = highestWeek; week >= 1; week--) {
            long scoreCount = scoreRuns.getOrDefault(week, 0L);
            long timeCount = timeRuns.getOrDefault(week, 0L);
            summaries.add(new ContributorWeeklyRunsResponse(week, scoreCount, timeCount));
        }
        return summaries;
    }

    private int safeWeek(Integer value) {
        return value != null && value > 0 ? value : 0;
    }
}
