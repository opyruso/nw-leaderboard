package com.opyruso.nwleaderboard.service;

import com.opyruso.nwleaderboard.dto.ContributorWeeklyRunsResponse;
import com.opyruso.nwleaderboard.repository.RunScoreRepository;
import com.opyruso.nwleaderboard.repository.RunTimeRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Provides aggregated statistics about runs submitted by contributors.
 */
@ApplicationScoped
public class ContributorStatisticsService {

    @Inject
    RunScoreRepository runScoreRepository;

    @Inject
    RunTimeRepository runTimeRepository;

    @Inject
    RegionService regionService;

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

        List<String> regionOrder = regionService.listRegions().stream()
                .map(region -> region != null ? region.getId() : null)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toList());
        if (regionOrder.isEmpty()) {
            regionOrder = List.of();
        }

        Map<Integer, Map<String, Long>> scoreRuns = new HashMap<>(runScoreRepository.countRunsGroupedByWeekAndRegion());
        Map<Integer, Map<String, Long>> timeRuns = new HashMap<>(runTimeRepository.countRunsGroupedByWeekAndRegion());

        List<ContributorWeeklyRunsResponse> summaries = new ArrayList<>(highestWeek);
        for (int week = highestWeek; week >= 1; week--) {
            Map<String, Long> scoreByRegion = buildRegionCounts(regionOrder, scoreRuns.get(week));
            Map<String, Long> timeByRegion = buildRegionCounts(regionOrder, timeRuns.get(week));
            summaries.add(new ContributorWeeklyRunsResponse(week, scoreByRegion, timeByRegion));
        }
        return summaries;
    }

    private Map<String, Long> buildRegionCounts(List<String> regionOrder, Map<String, Long> counts) {
        Map<String, Long> ordered = new LinkedHashMap<>();
        if (regionOrder != null && !regionOrder.isEmpty()) {
            for (String regionId : regionOrder) {
                long value = counts != null ? counts.getOrDefault(regionId, 0L) : 0L;
                ordered.put(regionId, value);
            }
        }
        if (counts != null) {
            for (Map.Entry<String, Long> entry : counts.entrySet()) {
                String regionId = entry.getKey();
                if (regionId == null || regionId.isBlank()) {
                    continue;
                }
                ordered.putIfAbsent(regionId, entry.getValue());
            }
        }
        return ordered;
    }

    private int safeWeek(Integer value) {
        return value != null && value > 0 ? value : 0;
    }
}
