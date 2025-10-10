import { LangContext } from '../i18n.js';
import ChartCanvas from '../components/ChartCanvas.js';
import DungeonIcon from '../components/DungeonIcon.js';
import MutationIconList from '../components/MutationIconList.js';
import RankBadge from '../components/RankBadge.js';
import SeasonCarousel from '../components/SeasonCarousel.js';
import { getDungeonNameForLang, normaliseDungeons, sortDungeons } from '../dungeons.js';
import {
  extractMutationIds,
  getAllMutationCurseIds,
  getAllMutationPromotionIds,
  getAllMutationTypeIds,
  getMutationIconSources,
} from '../mutations.js';
import { formatPlayerLinkProps } from '../playerNames.js';
import { translateRegion, extractRegionId, normaliseRegionList, DEFAULT_REGIONS } from '../regions.js';
import {
  sortSeasons,
  findCurrentSeasonId,
  SEASON_STORAGE_PREFIX,
  loadStoredSeasonId,
  saveStoredSeasonId,
  normaliseSeasonFilterValue,
} from '../seasons.js';
import { capitaliseWords } from '../text.js';
import { ThemeContext } from '../theme.js';
import useDragScroll from '../hooks/useDragScroll.js';

const { Link } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = Object.freeze([25, 50, 100]);
const MUTATION_FILTER_KEYS = ['type', 'promotion', 'curse'];
const FILTER_STORAGE_PREFIX = 'nwleaderboard:filters:';
const SHARED_FILTER_STORAGE_KEY = `${FILTER_STORAGE_PREFIX}score-time`;
const SHARED_FILTER_MODES = new Set(['score', 'time']);

function normaliseWeekFilterValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  if (trimmed.length === 0) {
    return null;
  }
  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return String(numeric);
}

function getFilterStorageKeys(mode, { includeLegacy = false } = {}) {
  if (!mode) {
    return [];
  }
  if (SHARED_FILTER_MODES.has(mode)) {
    const keys = [SHARED_FILTER_STORAGE_KEY];
    if (includeLegacy) {
      keys.push(`${FILTER_STORAGE_PREFIX}${mode}`);
    }
    return keys;
  }
  return [`${FILTER_STORAGE_PREFIX}${mode}`];
}

function normaliseStoredFilters(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const storedMutation = parsed.mutation && typeof parsed.mutation === 'object' ? parsed.mutation : {};
  const mutation = createEmptyMutationFilters();
  MUTATION_FILTER_KEYS.forEach((key) => {
    const values = Array.isArray(storedMutation[key]) ? storedMutation[key] : [];
    mutation[key] = values
      .map((value) => (typeof value === 'string' ? value.trim() : String(value || '').trim()))
      .filter((value) => value.length > 0);
  });
  const regions = Array.isArray(parsed.regions)
    ? parsed.regions
        .map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
        .filter((value) => value.length > 0)
    : [];
  const dungeon =
    typeof parsed.dungeon === 'string' || typeof parsed.dungeon === 'number'
      ? String(parsed.dungeon).trim()
      : '';
  const weeks = Array.isArray(parsed.weeks)
    ? parsed.weeks
        .map((value) => normaliseWeekFilterValue(value))
        .filter(Boolean)
    : [];
  return { mutation, regions, dungeon: dungeon || null, weeks };
}

function createEmptyMutationFilters() {
  return { type: [], promotion: [], curse: [] };
}

function loadStoredFilters(mode) {
  if (!mode || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  const storageKeys = getFilterStorageKeys(mode, { includeLegacy: true });
  for (const key of storageKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw);
      const normalised = normaliseStoredFilters(parsed);
      if (!normalised) {
        continue;
      }
      if (SHARED_FILTER_MODES.has(mode) && key !== SHARED_FILTER_STORAGE_KEY) {
        saveStoredFilters(
          mode,
          normalised.mutation,
          normalised.regions,
          normalised.dungeon,
          normalised.weeks,
        );
      }
      return normalised;
    } catch (error) {
      // ignore malformed storage entries and continue
    }
  }
  return null;
}

function saveStoredFilters(mode, mutationFilters, regionFilters, dungeonId, weekFilters) {
  if (!mode || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const payload = {
      mutation: MUTATION_FILTER_KEYS.reduce((result, key) => {
        const values = Array.isArray(mutationFilters?.[key]) ? mutationFilters[key] : [];
        result[key] = values
          .map((value) => (typeof value === 'string' ? value.trim() : String(value || '').trim()))
          .filter((value) => value.length > 0);
        return result;
      }, {}),
      regions: Array.isArray(regionFilters)
        ? regionFilters
            .map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
            .filter((value) => value.length > 0)
        : [],
      dungeon:
        typeof dungeonId === 'string' || typeof dungeonId === 'number'
          ? String(dungeonId).trim()
          : null,
      weeks: Array.isArray(weekFilters)
        ? weekFilters
            .map((value) => normaliseWeekFilterValue(value))
            .filter(Boolean)
        : [],
    };
    const storageKeys = Array.from(new Set(getFilterStorageKeys(mode, { includeLegacy: true })));
    storageKeys.forEach((key) => {
      window.localStorage.setItem(key, JSON.stringify(payload));
    });
  } catch (error) {
    // ignore storage errors
  }
}

function normalisePlayers(entry) {
  const { players, members, team, squad, group, party } = entry || {};
  const source =
    players ?? members ?? team ?? squad ?? group ?? party ?? entry?.playerNames ?? entry?.names ?? entry?.users;
  if (!source) {
    return [];
  }

  const collected = [];
  const pushPlayer = (value) => {
    const props = formatPlayerLinkProps(value);
    if (!props) {
      return;
    }
    const displayName = typeof props.displayName === 'string' ? props.displayName.trim() : '';
    if (!props.id && !displayName) {
      return;
    }
    collected.push(props);
  };

  if (Array.isArray(source)) {
    source.forEach((value) => {
      if (!value) {
        return;
      }
      if (typeof value === 'string') {
        pushPlayer({ playerName: value });
        return;
      }
      if (typeof value === 'object') {
        pushPlayer(value);
      }
    });
  } else if (typeof source === 'string') {
    source
      .split(/[,;\n]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => pushPlayer({ playerName: value }));
  }

  if (collected.length === 0) {
    return [];
  }

  const unique = [];
  const seen = new Set();
  collected.forEach((player) => {
    const key = propsKey(player);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(player);
  });
  return unique;
}

function propsKey(player) {
  if (!player) {
    return null;
  }
  if (player.id) {
    return `id:${player.id}`;
  }
  if (player.displayName) {
    return `name:${player.displayName.toLowerCase()}`;
  }
  return null;
}

function deriveWeek(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const { week, period, season, date, label, title, range } = entry;
  return week ?? period ?? season ?? date ?? label ?? title ?? range ?? '';
}

export default function LeaderboardPage({
  mode,
  pageTitle,
  getValue,
  formatValue,
  getSortValue,
  sortDirection = 'desc',
  chartConfig,
  showDungeonIconInTitle = true,
}) {
  const { t, lang } = React.useContext(LangContext);
  const { theme } = React.useContext(ThemeContext);
  const storedFilters = React.useMemo(() => loadStoredFilters(mode), [mode]);
  const [dungeons, setDungeons] = React.useState([]);
  const [dungeonsLoading, setDungeonsLoading] = React.useState(false);
  const [dungeonsError, setDungeonsError] = React.useState(false);
  const [selectedDungeon, setSelectedDungeon] = React.useState(() => {
    if (!storedFilters?.dungeon) {
      return null;
    }
    return storedFilters.dungeon;
  });
  const [entries, setEntries] = React.useState([]);
  const [entriesLoading, setEntriesLoading] = React.useState(false);
  const [entriesError, setEntriesError] = React.useState(false);
  const [chartData, setChartData] = React.useState(null);
  const [chartError, setChartError] = React.useState(false);
  const [seasons, setSeasons] = React.useState([]);
  const [seasonLoading, setSeasonLoading] = React.useState(false);
  const [seasonError, setSeasonError] = React.useState(false);
  const seasonStorageKey = React.useMemo(
    () => `${SEASON_STORAGE_PREFIX}leaderboard:${mode || 'default'}`,
    [mode],
  );
  const [selectedSeasonId, setSelectedSeasonId] = React.useState(() =>
    loadStoredSeasonId(seasonStorageKey),
  );
  const [seasonInitialised, setSeasonInitialised] = React.useState(false);
  const [mutationFilters, setMutationFilters] = React.useState(() => {
    if (storedFilters?.mutation) {
      const initial = createEmptyMutationFilters();
      MUTATION_FILTER_KEYS.forEach((key) => {
        initial[key] = Array.isArray(storedFilters.mutation[key])
          ? storedFilters.mutation[key]
          : [];
      });
      return initial;
    }
    return createEmptyMutationFilters();
  });
  const [regionFilters, setRegionFilters] = React.useState(() =>
    Array.isArray(storedFilters?.regions) ? storedFilters.regions : [],
  );
  const [selectedWeeks, setSelectedWeeks] = React.useState(() =>
    Array.isArray(storedFilters?.weeks) ? storedFilters.weeks : [],
  );
  const [weekOptions, setWeekOptions] = React.useState([]);
  const [weekLoading, setWeekLoading] = React.useState(false);
  const [weekError, setWeekError] = React.useState(false);
  const weekTrackRef = React.useRef(null);
  useDragScroll(weekTrackRef);
  const [regionOptions, setRegionOptions] = React.useState([]);
  const [regionLoading, setRegionLoading] = React.useState(false);
  const [regionError, setRegionError] = React.useState(false);
  const [isDungeonCollapsed, setIsDungeonCollapsed] = React.useState(false);
  const [isRegionCollapsed, setIsRegionCollapsed] = React.useState(true);
  const [isMutationCollapsed, setIsMutationCollapsed] = React.useState(true);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [requestedPage, setRequestedPage] = React.useState(1);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInputValue, setPageInputValue] = React.useState('1');
  const [totalEntries, setTotalEntries] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const mutationIconCache = React.useRef(new Map());
  const mutationFiltersInitialisedRef = React.useRef(false);
  const hasUserAdjustedMutationFiltersRef = React.useRef(false);
  const regionFiltersInitialisedRef = React.useRef(false);
  const hasUserAdjustedRegionFiltersRef = React.useRef(false);
  const weekFiltersInitialisedRef = React.useRef(false);
  const hasUserAdjustedWeekFiltersRef = React.useRef(false);
  const weekFetchAttemptedRef = React.useRef(false);
  const [isMobileViewport, setIsMobileViewport] = React.useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(max-width: 768px)').matches;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const updateViewportMatch = (event) => {
      setIsMobileViewport(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateViewportMatch);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(updateViewportMatch);
    }

    // ensure the initial value stays in sync with the current viewport
    setIsMobileViewport(mediaQuery.matches);

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updateViewportMatch);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(updateViewportMatch);
      }
    };
  }, []);

  React.useEffect(() => {
    if (storedFilters?.mutation) {
      mutationFiltersInitialisedRef.current = true;
      hasUserAdjustedMutationFiltersRef.current = true;
    }
    if (Array.isArray(storedFilters?.regions) && storedFilters.regions.length > 0) {
      regionFiltersInitialisedRef.current = true;
      hasUserAdjustedRegionFiltersRef.current = true;
    }
    if (Array.isArray(storedFilters?.weeks) && storedFilters.weeks.length > 0) {
      hasUserAdjustedWeekFiltersRef.current = true;
    }
  }, [storedFilters]);

  React.useEffect(() => {
    const storedSeason = loadStoredSeasonId(seasonStorageKey);
    if (storedSeason === undefined) {
      setSelectedSeasonId(undefined);
      return;
    }
    setSelectedSeasonId((previous) => {
      if (previous === storedSeason || (previous === null && storedSeason === null)) {
        return previous;
      }
      return storedSeason;
    });
  }, [seasonStorageKey]);

  React.useEffect(() => {
    setSelectedWeeks((previous) => {
      const currentValues = Array.isArray(previous)
        ? previous.map((value) => normaliseWeekFilterValue(value)).filter(Boolean)
        : [];
      const available = Array.isArray(weekOptions)
        ? weekOptions.map((value) => normaliseWeekFilterValue(value)).filter(Boolean)
        : [];
      const uniqueCurrent = Array.from(new Set(currentValues));
      let finalValues = uniqueCurrent.filter((value) => available.includes(value));

      if (weekFetchAttemptedRef.current && !weekFiltersInitialisedRef.current) {
        const stored = Array.isArray(storedFilters?.weeks)
          ? storedFilters.weeks.map((value) => normaliseWeekFilterValue(value)).filter(Boolean)
          : [];
        if (stored.length > 0) {
          const sanitisedStored = stored.filter((value) => available.includes(value));
          if (sanitisedStored.length > 0) {
            finalValues = sanitisedStored;
            hasUserAdjustedWeekFiltersRef.current = true;
          }
        }
        if (!weekLoading) {
          weekFiltersInitialisedRef.current = true;
        }
      }

      if (
        finalValues.length !== uniqueCurrent.length ||
        finalValues.some((value, index) => value !== uniqueCurrent[index])
      ) {
        return finalValues;
      }
      return uniqueCurrent;
    });
  }, [weekOptions, storedFilters, weekLoading]);

  const handleMutationPanelToggle = React.useCallback(() => {
    setIsMutationCollapsed((previous) => !previous);
  }, []);

  const handleRegionPanelToggle = React.useCallback(() => {
    setIsRegionCollapsed((previous) => !previous);
  }, []);

  const handleWeekFilterToggle = React.useCallback((week) => {
    if (week === null || week === undefined || week === '') {
      weekFiltersInitialisedRef.current = true;
      hasUserAdjustedWeekFiltersRef.current = true;
      setSelectedWeeks([]);
      return;
    }
    const normalised = normaliseWeekFilterValue(week);
    if (!normalised) {
      return;
    }
    weekFiltersInitialisedRef.current = true;
    hasUserAdjustedWeekFiltersRef.current = true;
    setSelectedWeeks((previous) => {
      const currentValues = Array.isArray(previous)
        ? previous.map((value) => normaliseWeekFilterValue(value)).filter(Boolean)
        : [];
      if (currentValues.includes(normalised)) {
        return currentValues.filter((value) => value !== normalised);
      }
      return [...currentValues, normalised];
    });
  }, []);

  const mutationOptions = React.useMemo(() => {
    const sortOptions = (values) =>
      values
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

    return {
      type: sortOptions(getAllMutationTypeIds()),
      promotion: sortOptions(getAllMutationPromotionIds()),
      curse: sortOptions(getAllMutationCurseIds()),
    };
  }, []);

  const buildFilterParamsWithoutPagination = React.useCallback(() => {
    const params = new URLSearchParams();
    if (!selectedDungeon) {
      return params;
    }

    params.set('dungeonId', String(selectedDungeon));

    const filterParamMap = {
      type: 'mutationType',
      promotion: 'mutationPromotion',
      curse: 'mutationCurse',
    };

    const mutationFiltersReady = mutationFiltersInitialisedRef.current;
    const regionFiltersReady = regionFiltersInitialisedRef.current;

    MUTATION_FILTER_KEYS.forEach((key) => {
      const paramName = filterParamMap[key];
      const available = Array.isArray(mutationOptions[key]) ? mutationOptions[key] : [];
      if (!paramName || available.length === 0) {
        return;
      }
      const selected = Array.isArray(mutationFilters[key]) ? mutationFilters[key] : [];
      const uniqueSelected = Array.from(
        new Set(
          selected.map((value) =>
            typeof value === 'string' ? value : String(value === undefined || value === null ? '' : value),
          ),
        ),
      );
      const sanitisedSelected = uniqueSelected.filter((value) => available.includes(value));
      if (!mutationFiltersReady) {
        return;
      }
      const shouldFilter = sanitisedSelected.length < available.length || selected.length === 0;
      if (!shouldFilter) {
        return;
      }
      if (sanitisedSelected.length === 0) {
        params.append(paramName, '');
        return;
      }
      sanitisedSelected.forEach((value) => params.append(paramName, value));
    });

    if (regionFiltersReady) {
      const availableRegions = Array.isArray(regionOptions) ? regionOptions : [];
      const selectedRegions = Array.isArray(regionFilters) ? regionFilters : [];
      const uniqueRegions = Array.from(
        new Set(
          selectedRegions.map((value) =>
            typeof value === 'string' ? value.trim().toUpperCase() : String(value || '').trim().toUpperCase(),
          ),
        ),
      );
      const sanitisedRegions = uniqueRegions.filter((value) => availableRegions.includes(value));
      const shouldFilter = sanitisedRegions.length > 0 && sanitisedRegions.length < availableRegions.length;
      if (shouldFilter) {
        sanitisedRegions.forEach((value) => params.append('region', value));
      } else if (sanitisedRegions.length === 0 && selectedRegions.length > 0) {
        params.append('region', '');
      }
    }

    if (weekFiltersInitialisedRef.current) {
      const availableWeeks = Array.isArray(weekOptions)
        ? weekOptions.map((value) => normaliseWeekFilterValue(value)).filter(Boolean)
        : [];
      const selectedWeekValues = Array.isArray(selectedWeeks)
        ? selectedWeeks.map((value) => normaliseWeekFilterValue(value)).filter(Boolean)
        : [];
      const uniqueWeeks = Array.from(new Set(selectedWeekValues));
      const sanitisedWeeks = uniqueWeeks.filter((value) => availableWeeks.includes(value));
      if (sanitisedWeeks.length > 0) {
        sanitisedWeeks.forEach((value) => params.append('week', value));
      }
    }

    const seasonFilterId = normaliseSeasonFilterValue(selectedSeasonId);
    if (seasonFilterId !== null && seasonFilterId !== undefined) {
      params.set('seasonId', seasonFilterId);
    }

    return params;
  }, [
    selectedDungeon,
    mutationFilters,
    mutationOptions,
    regionFilters,
    regionOptions,
    selectedWeeks,
    weekOptions,
    selectedSeasonId,
  ]);

  const buildFilterParams = React.useCallback(
    (options = {}) => {
      const { includePagination = true, page: pageOverride, pageSize: pageSizeOverride } =
        typeof options === 'object' && options !== null ? options : {};

      const params = buildFilterParamsWithoutPagination();
      if (!includePagination) {
        return params;
      }

      const rawPage =
        pageOverride !== undefined && pageOverride !== null ? pageOverride : requestedPage;
      const numericPage = Number(rawPage);
      const safePage = Number.isFinite(numericPage) && numericPage > 0 ? Math.floor(numericPage) : 1;
      params.set('page', String(safePage));

      const rawPageSize =
        pageSizeOverride !== undefined && pageSizeOverride !== null ? pageSizeOverride : pageSize;
      const numericPageSize = Number(rawPageSize);
      const safePageSize =
        Number.isFinite(numericPageSize) && numericPageSize > 0
          ? Math.floor(numericPageSize)
          : pageSize;
      params.set('pageSize', String(safePageSize));

      return params;
    },
    [buildFilterParamsWithoutPagination, requestedPage, pageSize],
  );

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setSeasonLoading(true);
    setSeasonError(false);

    fetch(`${API_BASE_URL}/seasons`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load seasons: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const sorted = sortSeasons(Array.isArray(data) ? data : []);
        const availableIds = sorted.map((season) => String(season.id));
        const currentSeasonId = findCurrentSeasonId(sorted);
        const fallbackSeasonId =
          currentSeasonId && availableIds.includes(currentSeasonId)
            ? currentSeasonId
            : availableIds[0] ?? null;
        setSeasons(sorted);
        setSelectedSeasonId((previous) => {
          const normalisedPrevious =
            previous === null || previous === undefined ? previous : String(previous);
          if (normalisedPrevious === null) {
            return null;
          }
          if (seasonInitialised) {
            if (
              typeof normalisedPrevious === 'string' &&
              availableIds.includes(normalisedPrevious)
            ) {
              return normalisedPrevious;
            }
            return fallbackSeasonId ?? null;
          }
          if (typeof normalisedPrevious === 'string' && availableIds.includes(normalisedPrevious)) {
            return normalisedPrevious;
          }
          return fallbackSeasonId ?? null;
        });
      })
      .catch((fetchError) => {
        if (!active || fetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load seasons', fetchError);
        setSeasonError(true);
        setSeasons([]);
        if (!seasonInitialised) {
          setSelectedSeasonId(null);
        }
      })
      .finally(() => {
        if (active) {
          setSeasonLoading(false);
          setSeasonInitialised(true);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setRegionLoading(true);
    setRegionError(false);

    fetch(`${API_BASE_URL}/leaderboard/regions`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load regions: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const normalised = normaliseRegionList(data, DEFAULT_REGIONS);
        setRegionOptions(normalised);
        setRegionLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setRegionOptions(normaliseRegionList([], DEFAULT_REGIONS));
        setRegionError(true);
        setRegionLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [mode]);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setDungeonsLoading(true);
    setDungeonsError(false);

    fetch(`${API_BASE_URL}/dungeons`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load dungeons: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const normalised = normaliseDungeons(data);
        setDungeons(normalised);
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') {
          return;
        }
        console.error('Unable to load dungeons', error);
        setDungeonsError(true);
        setDungeons([]);
      })
      .finally(() => {
        if (active) {
          setDungeonsLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  React.useEffect(() => {
    if (!seasonInitialised) {
      return;
    }
    if (!selectedDungeon) {
      weekFiltersInitialisedRef.current = false;
      setWeekOptions([]);
      setWeekLoading(false);
      setWeekError(false);
      weekFetchAttemptedRef.current = true;
      return;
    }

    let active = true;
    const controller = new AbortController();
    weekFiltersInitialisedRef.current = false;
    setWeekLoading(true);
    setWeekError(false);
    weekFetchAttemptedRef.current = true;

    const params = new URLSearchParams();
    params.set('dungeonId', String(selectedDungeon));
    const seasonFilterId = normaliseSeasonFilterValue(selectedSeasonId);
    if (seasonFilterId !== null && seasonFilterId !== undefined) {
      params.set('seasonId', seasonFilterId);
    }

    fetch(`${API_BASE_URL}/leaderboard/weeks?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load weeks: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const unique = Array.from(
          new Set(
            (Array.isArray(data) ? data : [])
              .map((value) => normaliseWeekFilterValue(value))
              .filter(Boolean),
          ),
        );
        unique.sort((left, right) => {
          const leftNumber = Number(left);
          const rightNumber = Number(right);
          if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
            return rightNumber - leftNumber;
          }
          return left.localeCompare(right, undefined, { numeric: true });
        });
        setWeekOptions(unique);
        setWeekLoading(false);
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') {
          return;
        }
        console.error('Unable to load weeks', error);
        setWeekOptions([]);
        setWeekError(true);
        setWeekLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [seasonInitialised, selectedDungeon, selectedSeasonId]);

  React.useEffect(() => {
    if (!Array.isArray(dungeons) || dungeons.length === 0) {
      if (dungeonsLoading) {
        return;
      }
      setSelectedDungeon((previous) => {
        if (previous === null) {
          return previous;
        }
        return null;
      });
      return;
    }
    setSelectedDungeon((previous) => {
      if (previous) {
        const previousId = String(previous);
        const hasPrevious = dungeons.some((dungeon) => {
          const dungeonId =
            typeof dungeon.id === 'string' || typeof dungeon.id === 'number'
              ? String(dungeon.id)
              : '';
          return dungeonId === previousId;
        });
        if (hasPrevious) {
          return previousId;
        }
      }
      const [first] = sortDungeons(dungeons, lang);
      const nextId =
        first && (typeof first.id === 'string' || typeof first.id === 'number')
          ? String(first.id)
          : null;
      return nextId;
    });
  }, [dungeons, lang, dungeonsLoading]);

  React.useEffect(() => {
    if (!seasonInitialised) {
      return;
    }
    if (!selectedDungeon) {
      setEntries([]);
      setEntriesLoading(false);
      setEntriesError(false);
      setTotalEntries(0);
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setEntriesLoading(true);
    setEntriesError(false);

    const params = buildFilterParams();
    const fallbackRequested = Number.isFinite(Number(requestedPage))
      ? Math.max(1, Math.floor(Number(requestedPage)))
      : 1;
    const paramRequested = Number(params.get('page'));
    const safeRequested = Number.isFinite(paramRequested) && paramRequested > 0
      ? Math.floor(paramRequested)
      : fallbackRequested;

    fetch(`${API_BASE_URL}/leaderboard/${mode}?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load leaderboard: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const entriesData = Array.isArray(data?.entries) ? data.entries : [];
        const responsePage = Number(data?.page);
        const responsePageSize = Number(data?.pageSize);
        const responseTotal = Number(data?.totalEntries);
        const responseTotalPages = Number(data?.totalPages);

        const safePageSize = Number.isFinite(responsePageSize) && responsePageSize > 0
          ? responsePageSize
          : pageSize;
        if (safePageSize !== pageSize) {
          setPageSize(safePageSize);
        }

        const safeTotalEntries = Number.isFinite(responseTotal) && responseTotal >= 0
          ? responseTotal
          : entriesData.length;
        setTotalEntries(safeTotalEntries);

        const computedTotalPages = Number.isFinite(responseTotalPages) && responseTotalPages >= 1
          ? Math.floor(responseTotalPages)
          : Math.max(Math.ceil(safeTotalEntries / Math.max(safePageSize, 1)), 1);
        setTotalPages(computedTotalPages);

        const safePage = Number.isFinite(responsePage) && responsePage >= 1
          ? Math.floor(responsePage)
          : safeRequested;
        setCurrentPage((previous) => (previous === safePage ? previous : safePage));

        const normalisedEntries = entriesData.map((entry, index) => {
          const value = getValue(entry);
          const players = normalisePlayers(entry);
          const week = deriveWeek(entry);
          const position =
            entry?.position ?? entry?.rank ?? entry?.place ?? entry?.standing ?? entry?.pos ?? null;
          const mutations = extractMutationIds(
            entry,
            entry?.mutations,
            entry?.mutation,
            entry?.mutationInfo,
            entry?.mutation_ids,
            entry?.mutationIds,
          );
          const id = entry?.id ?? entry?.entryId ?? `${week || 'entry'}-${index}`;
          return {
            id: String(id),
            week: week ? String(week) : '',
            region: extractRegionId(entry),
            players,
            value,
            position,
            mutations,
            raw: entry,
          };
        });
        setEntries(normalisedEntries);
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') {
          return;
        }
        console.error('Unable to load leaderboard entries', error);
        setEntriesError(true);
        setEntries([]);
        setTotalEntries(0);
        setTotalPages(1);
      })
      .finally(() => {
        if (active) {
          setEntriesLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    mode,
    selectedDungeon,
    getValue,
    requestedPage,
    pageSize,
    buildFilterParams,
    seasonInitialised,
    selectedSeasonId,
  ]);

  React.useEffect(() => {
    if (!seasonInitialised) {
      return;
    }
    if (!selectedDungeon) {
      setChartData(null);
      setChartError(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setChartError(false);

    const params = buildFilterParamsWithoutPagination();
    setChartData(null);

    fetch(`${API_BASE_URL}/leaderboard/${mode}/chart?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load leaderboard chart: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        if (data && typeof data === 'object') {
          const weeks = Array.isArray(data.weeks) ? data.weeks : [];
          const numericAverage = Number(data.globalAverage);
          const globalAverage =
            typeof data.globalAverage === 'number' && Number.isFinite(data.globalAverage)
              ? data.globalAverage
              : Number.isFinite(numericAverage)
                ? numericAverage
                : null;
          setChartData({ weeks, globalAverage });
        } else {
          setChartData({ weeks: [], globalAverage: null });
        }
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') {
          return;
        }
        console.error('Unable to load leaderboard chart', error);
        setChartError(true);
        setChartData(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [mode, selectedDungeon, buildFilterParamsWithoutPagination, seasonInitialised, selectedSeasonId]);

  const sortedDungeons = React.useMemo(() => sortDungeons(dungeons, lang), [dungeons, lang]);

  React.useEffect(() => {
    setMutationFilters((previous) => {
      const safePrevious =
        previous && typeof previous === 'object' ? previous : createEmptyMutationFilters();

      let changed = false;
      const next = {};

      MUTATION_FILTER_KEYS.forEach((key) => {
        const available = Array.isArray(mutationOptions[key]) ? mutationOptions[key] : [];
        const currentValues = Array.isArray(safePrevious[key]) ? safePrevious[key] : [];
        const uniqueValues = Array.from(
          new Set(
            currentValues.map((value) => (typeof value === 'string' ? value : String(value))),
          ),
        );
        let finalValues = uniqueValues.filter((value) => available.includes(value));

        if (!mutationFiltersInitialisedRef.current && available.length > 0) {
          const storedValues = storedFilters?.mutation && Array.isArray(storedFilters.mutation[key])
            ? storedFilters.mutation[key]
            : [];
          if (storedValues.length > 0) {
            const storedUnique = Array.from(
              new Set(
                storedValues.map((value) => (typeof value === 'string' ? value : String(value))),
              ),
            );
            const sanitisedStored = storedUnique.filter((value) => available.includes(value));
            if (sanitisedStored.length > 0) {
              finalValues = sanitisedStored;
              hasUserAdjustedMutationFiltersRef.current = true;
            }
          }

          if (!hasUserAdjustedMutationFiltersRef.current && finalValues.length !== available.length) {
            finalValues = available.slice();
          }
        }

        if (
          finalValues.length !== currentValues.length ||
          finalValues.some((value, index) => value !== currentValues[index])
        ) {
          changed = true;
        }

        next[key] = finalValues;
      });

      mutationFiltersInitialisedRef.current = true;
      return changed ? next : safePrevious;
    });
  }, [mutationOptions, selectedDungeon, storedFilters]);

  React.useEffect(() => {
    setRegionFilters((previous) => {
      const currentValues = Array.isArray(previous) ? previous : [];
      const uniqueValues = Array.from(
        new Set(
          currentValues.map((value) =>
            typeof value === 'string' ? value.trim().toUpperCase() : String(value || '').trim().toUpperCase(),
          ),
        ),
      );
      const available = Array.isArray(regionOptions) ? regionOptions : [];
      let finalValues = uniqueValues.filter((value) => available.includes(value));

      if (!regionFiltersInitialisedRef.current) {
        const stored = Array.isArray(storedFilters?.regions) ? storedFilters.regions : [];
        if (stored.length > 0) {
          const storedUnique = Array.from(
            new Set(
              stored.map((value) =>
                typeof value === 'string' ? value.trim().toUpperCase() : String(value || '').trim().toUpperCase(),
              ),
            ),
          );
          const sanitisedStored = storedUnique.filter((value) => available.includes(value));
          if (sanitisedStored.length > 0) {
            finalValues = sanitisedStored;
            hasUserAdjustedRegionFiltersRef.current = true;
          }
        }
        regionFiltersInitialisedRef.current = true;
      }

      if (
        finalValues.length !== currentValues.length ||
        finalValues.some((value, index) => value !== currentValues[index])
      ) {
        return finalValues;
      }
      return currentValues;
    });
  }, [regionOptions, storedFilters]);

  React.useEffect(() => {
    setRequestedPage(1);
    setCurrentPage(1);
  }, [selectedDungeon, mutationFilters, regionFilters, selectedSeasonId, selectedWeeks]);

  const handleMutationFilterToggle = React.useCallback((key, value) => {
    if (!MUTATION_FILTER_KEYS.includes(key)) {
      return;
    }

    mutationFiltersInitialisedRef.current = true;
    hasUserAdjustedMutationFiltersRef.current = true;
    setMutationFilters((previous) => {
      const safePrevious =
        previous && typeof previous === 'object' ? previous : createEmptyMutationFilters();
      const currentValues = Array.isArray(safePrevious[key]) ? safePrevious[key] : [];
      const rawValue = typeof value === 'string' ? value : String(value);
      const normalisedValue = rawValue.trim();
      if (!normalisedValue) {
        return safePrevious;
      }
      const hasValue = currentValues.includes(normalisedValue);
      let nextValues;
      if (hasValue) {
        nextValues = currentValues.filter((item) => item !== normalisedValue);
      } else {
        nextValues = currentValues.concat(normalisedValue);
      }

      if (nextValues.length === currentValues.length && hasValue) {
        return safePrevious;
      }
      if (!hasValue && nextValues.length === currentValues.length) {
        return safePrevious;
      }

      const uniqueValues = Array.from(new Set(nextValues));
      return { ...safePrevious, [key]: uniqueValues };
    });
  }, []);

  const handleRegionFilterToggle = React.useCallback((value) => {
    const normalised = typeof value === 'string' ? value.trim().toUpperCase() : '';
    regionFiltersInitialisedRef.current = true;
    if (!normalised) {
      hasUserAdjustedRegionFiltersRef.current = true;
      setRegionFilters([]);
      return;
    }
    hasUserAdjustedRegionFiltersRef.current = true;
    setRegionFilters((previous) => {
      const currentValues = Array.isArray(previous) ? previous : [];
      const hasValue = currentValues.includes(normalised);
      if (hasValue) {
        return currentValues.filter((item) => item !== normalised);
      }
      return Array.from(new Set([...currentValues, normalised]));
    });
  }, []);

  const handleSeasonSelect = React.useCallback((value) => {
    const next = normaliseSeasonFilterValue(value);
    if (next === undefined) {
      return;
    }
    setSelectedSeasonId((previous) => {
      if (previous === next || (previous === null && next === null)) {
        return previous;
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    saveStoredFilters(mode, mutationFilters, regionFilters, selectedDungeon, selectedWeeks);
  }, [mode, mutationFilters, regionFilters, selectedDungeon, selectedWeeks]);

  React.useEffect(() => {
    saveStoredSeasonId(seasonStorageKey, selectedSeasonId);
  }, [seasonStorageKey, selectedSeasonId]);

  const getMutationIconSource = React.useCallback(
    (kind, id) => {
      if (!id) {
        return null;
      }
      const cacheKey = `${kind}:${id}`;
      const cache = mutationIconCache.current;
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }
      let sources = [];
      if (kind === 'type') {
        sources = getMutationIconSources({ typeId: id });
      } else if (kind === 'promotion') {
        sources = getMutationIconSources({ promotionId: id });
      } else if (kind === 'curse') {
        sources = getMutationIconSources({ curseId: id });
      }
      const [first] = sources;
      const src = first?.src || null;
      cache.set(cacheKey, src);
      return src;
    },
    [],
  );

  const filteredEntries = React.useMemo(() => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return [];
    }

    const typeFilters = Array.isArray(mutationFilters?.type) ? mutationFilters.type : [];
    const promotionFilters = Array.isArray(mutationFilters?.promotion)
      ? mutationFilters.promotion
      : [];
    const curseFilters = Array.isArray(mutationFilters?.curse) ? mutationFilters.curse : [];
    const regionFilterValues = Array.isArray(regionFilters) ? regionFilters : [];
    const weekFilterValues = Array.isArray(selectedWeeks)
      ? selectedWeeks.map((value) => normaliseWeekFilterValue(value)).filter(Boolean)
      : [];

    const hasTypeFilter = typeFilters.length > 0;
    const hasPromotionFilter = promotionFilters.length > 0;
    const hasCurseFilter = curseFilters.length > 0;
    const hasRegionFilter = regionFilterValues.length > 0;
    const hasWeekFilter = weekFilterValues.length > 0;

    if (!hasTypeFilter && !hasPromotionFilter && !hasCurseFilter && !hasRegionFilter && !hasWeekFilter) {
      return entries;
    }

    return entries.filter((entry) => {
      const mutations = entry?.mutations ?? extractMutationIds(entry?.raw);
      const typeId = mutations?.typeId ? String(mutations.typeId) : '';
      const promotionId = mutations?.promotionId ? String(mutations.promotionId) : '';
      const curseId = mutations?.curseId ? String(mutations.curseId) : '';

      if (hasWeekFilter) {
        const entryWeekValue = normaliseWeekFilterValue(entry?.week ?? deriveWeek(entry?.raw));
        if (!entryWeekValue || !weekFilterValues.includes(entryWeekValue)) {
          return false;
        }
      }

      if (hasTypeFilter && !typeFilters.includes(typeId)) {
        return false;
      }
      if (hasPromotionFilter && !promotionFilters.includes(promotionId)) {
        return false;
      }
      if (hasCurseFilter && !curseFilters.includes(curseId)) {
        return false;
      }
      if (hasRegionFilter) {
        const entryRegion =
          typeof entry?.region === 'string' ? entry.region.trim().toUpperCase() : '';
        if (entryRegion && regionFilterValues.includes(entryRegion)) {
          return true;
        }
        const fallbackRegion = extractRegionId(entry?.raw);
        if (!fallbackRegion || !regionFilterValues.includes(fallbackRegion)) {
          return false;
        }
        return true;
      }
      return true;
    });
  }, [entries, mutationFilters, regionFilters, selectedWeeks]);

  const formatWeekLabel = React.useCallback(
    (week) => {
      if (!week) {
        return t.leaderboardUnknownWeek;
      }
      const numeric = Number(week);
      if (Number.isFinite(numeric) && typeof t.playerWeekLabel === 'function') {
        return t.playerWeekLabel(numeric);
      }
      return String(week);
    },
    [t],
  );

  const chartMemo = React.useMemo(() => {
    if (!chartConfig) {
      return null;
    }
    if (!chartData) {
      return null;
    }

    const weeks = Array.isArray(chartData?.weeks) ? chartData.weeks : [];

    const legendColor = theme === 'light' ? 'rgba(30, 41, 59, 0.78)' : 'rgba(226, 232, 240, 0.92)';

    const parseNumeric = (value) => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      }
      return null;
    };

    const points = weeks
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const rawWeek =
          entry.week ?? entry.weekKey ?? entry.weekNumber ?? entry.numericWeek ?? entry.id ?? '';
        const weekKey = rawWeek === null || rawWeek === undefined ? '' : String(rawWeek);
        const numericWeek = Number(weekKey);
        const hasNumericWeek = Number.isFinite(numericWeek);
        const label =
          typeof chartConfig.formatWeek === 'function'
            ? chartConfig.formatWeek(weekKey, hasNumericWeek ? numericWeek : null)
            : formatWeekLabel(weekKey);
        const bestValue = parseNumeric(
          entry.bestValue ?? entry.best ?? entry.max ?? entry.high ?? entry.upper ?? null,
        );
        const worstValue = parseNumeric(
          entry.worstValue ?? entry.worst ?? entry.min ?? entry.low ?? entry.lower ?? null,
        );
        if (bestValue === null && worstValue === null) {
          return null;
        }
        return {
          weekKey,
          label,
          numericWeek: hasNumericWeek ? numericWeek : null,
          bestValue,
          worstValue,
          order: index,
        };
      })
      .filter(Boolean);

    points.sort((a, b) => {
      if (a.numericWeek !== null && b.numericWeek !== null && a.numericWeek !== b.numericWeek) {
        return a.numericWeek - b.numericWeek;
      }
      if (a.numericWeek !== null && b.numericWeek === null) {
        return -1;
      }
      if (a.numericWeek === null && b.numericWeek !== null) {
        return 1;
      }
      return a.order - b.order;
    });

    const labels = points.map((point) => point.label || formatWeekLabel(point.weekKey));
    const bestValues = points.map((point) => point.bestValue);
    const worstValues = points.map((point) => point.worstValue);

    const averageValue = parseNumeric(chartData?.globalAverage);
    const averageValues = Number.isFinite(averageValue) ? points.map(() => averageValue) : [];

    const datasets = [];
    if (chartConfig.bestLabel) {
      datasets.push({
        label: chartConfig.bestLabel,
        data: bestValues,
        borderColor: chartConfig.bestColor || '#7c5cff',
        backgroundColor: chartConfig.bestFill || 'rgba(124, 92, 255, 0.15)',
        pointBackgroundColor: chartConfig.bestPointColor || '#7c5cff',
        borderWidth: 2,
        tension: 0.25,
        fill: false,
      });
    }
    if (chartConfig.worstLabel) {
      datasets.push({
        label: chartConfig.worstLabel,
        data: worstValues,
        borderColor: chartConfig.worstColor || '#38bdf8',
        backgroundColor: chartConfig.worstFill || 'rgba(56, 189, 248, 0.15)',
        pointBackgroundColor: chartConfig.worstPointColor || '#38bdf8',
        borderWidth: 2,
        tension: 0.25,
        fill: false,
      });
    }
    if (chartConfig.averageLabel && Number.isFinite(averageValue)) {
      datasets.push({
        label: chartConfig.averageLabel,
        data: averageValues,
        borderColor: chartConfig.averageColor || 'rgba(148, 163, 184, 0.85)',
        borderDash: [6, 6],
        pointRadius: 0,
        fill: false,
      });
    }

    if (datasets.length === 0) {
      return null;
    }

    const numericValues = [];
    bestValues.forEach((value) => {
      if (Number.isFinite(value)) {
        numericValues.push(value);
      }
    });
    worstValues.forEach((value) => {
      if (Number.isFinite(value)) {
        numericValues.push(value);
      }
    });
    if (Number.isFinite(averageValue)) {
      numericValues.push(averageValue);
    }

    const hasNumericRange = numericValues.length > 0;
    const minValue = hasNumericRange ? Math.min(...numericValues) : null;
    const maxValue = hasNumericRange ? Math.max(...numericValues) : null;
    const span = hasNumericRange ? Math.abs(maxValue - minValue) : 0;
    const padding = span === 0 ? Math.max(1, Math.abs(maxValue || 0) * 0.05) : span * 0.05;

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(148, 163, 184, 0.85)' },
          title: chartConfig.xAxisLabel
            ? { display: true, text: chartConfig.xAxisLabel }
            : undefined,
        },
        y: {
          reverse: Boolean(chartConfig.reverseAxis),
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
          ticks: {
            color: 'rgba(148, 163, 184, 0.85)',
            callback: (value) =>
              typeof chartConfig.formatValue === 'function'
                ? chartConfig.formatValue(value)
                : value,
          },
          title: chartConfig.yAxisLabel
            ? { display: true, text: chartConfig.yAxisLabel }
            : undefined,
        },
      },
      plugins: {
        legend: {
          labels: { usePointStyle: true, color: legendColor },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              if (!items || items.length === 0) {
                return '';
              }
              const index = items[0].dataIndex;
              const point = points[index];
              if (!point) {
                return '';
              }
              if (typeof chartConfig.formatTooltipTitle === 'function') {
                return chartConfig.formatTooltipTitle(point.weekKey, point.numericWeek);
              }
              if (!point.weekKey) {
                return t.leaderboardUnknownWeek;
              }
              if (point.numericWeek !== null && typeof t.playerWeekLabel === 'function') {
                return t.playerWeekLabel(point.numericWeek);
              }
              return point.weekKey;
            },
            label: (context) => {
              const parsedValue = context.parsed.y;
              const formatted =
                typeof chartConfig.formatValue === 'function'
                  ? chartConfig.formatValue(parsedValue)
                  : parsedValue;
              return `${context.dataset.label}: ${formatted}`;
            },
          },
        },
      },
    };

    if (hasNumericRange) {
      options.scales.y.suggestedMin = minValue - padding;
      options.scales.y.suggestedMax = maxValue + padding;
    }

    return {
      data: {
        labels,
        datasets,
      },
      options,
    };
  }, [chartConfig, chartData, formatWeekLabel, t, theme]);

  const chartSection = chartMemo ? (
    <div className="leaderboard-chart">
      {chartConfig?.chartTitle ? (
        <h2 className="leaderboard-chart-title">{chartConfig.chartTitle}</h2>
      ) : null}
      <div className="leaderboard-chart-body">
        <ChartCanvas
          type="line"
          data={chartMemo.data}
          options={chartMemo.options}
          ariaLabel={chartConfig?.ariaLabel}
          className="leaderboard-chart-canvas"
        />
      </div>
    </div>
  ) : null;

  const seasonCarousel = (
    <SeasonCarousel
      label={t.seasonSelectorLabel}
      hideLabel
      loading={!seasonInitialised || seasonLoading}
      error={seasonError}
      seasons={seasons}
      selectedSeasonId={selectedSeasonId}
      onSelect={handleSeasonSelect}
      allLabel={t.seasonSelectorAll}
      loadingLabel={t.seasonSelectorLoading}
      errorLabel={t.seasonSelectorError}
      emptyLabel={t.seasonSelectorEmpty}
      formatSeasonLabel={(season) =>
        typeof t.seasonSelectorItemLabel === 'function'
          ? t.seasonSelectorItemLabel(season.id)
          : `Season ${season.id}`
      }
      formatSeasonTitle={(season) =>
        typeof t.seasonSelectorItemTitle === 'function'
          ? t.seasonSelectorItemTitle(season.id, season.dateBegin, season.dateEnd)
          : undefined
      }
      displayRange={false}
    />
  );

  const hasWeekOptions = Array.isArray(weekOptions) && weekOptions.length > 0;
  const isWeekSelectionActive = Array.isArray(selectedWeeks) && selectedWeeks.length > 0;

  const weekFilterPanel = (
    <div className="leaderboard-week-filter" aria-live="polite">
      {weekLoading ? (
        <p className="season-carousel-status">{t.weekFilterLoading}</p>
      ) : weekError ? (
        <p className="season-carousel-status error">{t.weekFilterError}</p>
      ) : hasWeekOptions ? (
        <div className="season-carousel" role="group" aria-label={t.weekFilterLabel}>
          <div className="season-carousel-track" role="list" ref={weekTrackRef}>
            <button
              type="button"
              className={`season-carousel-item${isWeekSelectionActive ? '' : ' selected'}`}
              aria-pressed={!isWeekSelectionActive}
              onClick={() => handleWeekFilterToggle(null)}
              role="listitem"
            >
              <span className="season-carousel-item-label">{t.weekFilterAll}</span>
            </button>
            {weekOptions.map((week) => {
              const weekKey = normaliseWeekFilterValue(week);
              if (!weekKey) {
                return null;
              }
              const displayLabel = formatWeekLabel(week);
              const isActive =
                isWeekSelectionActive && selectedWeeks.includes(weekKey);
              return (
                <button
                  key={weekKey}
                  type="button"
                  className={`season-carousel-item${isActive ? ' selected' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => handleWeekFilterToggle(weekKey)}
                  role="listitem"
                >
                  <span className="season-carousel-item-label">{displayLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="season-carousel-status">{t.weekFilterEmpty}</p>
      )}
    </div>
  );


  const sortedEntries = React.useMemo(() => {
    if (filteredEntries.length === 0) {
      return [];
    }
    const copy = filteredEntries.slice();
    copy.sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      const safeA = Number.isFinite(aValue) ? aValue : Number.NaN;
      const safeB = Number.isFinite(bValue) ? bValue : Number.NaN;
      if (Number.isNaN(safeA) && Number.isNaN(safeB)) {
        return 0;
      }
      if (Number.isNaN(safeA)) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      if (Number.isNaN(safeB)) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (safeA === safeB) {
        return 0;
      }
      return sortDirection === 'asc' ? safeA - safeB : safeB - safeA;
    });
    return copy;
  }, [filteredEntries, getSortValue, sortDirection]);

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));

  React.useEffect(() => {
    setCurrentPage((previous) => {
      const clamped = Math.min(Math.max(previous, 1), Math.max(totalPages, 1));
      if (clamped !== previous) {
        setRequestedPage(clamped);
        return clamped;
      }
      return previous;
    });
  }, [totalPages]);

  React.useEffect(() => {
    setPageInputValue((previous) => {
      const nextValue = String(safeCurrentPage);
      return previous === nextValue ? previous : nextValue;
    });
  }, [safeCurrentPage]);

  const displayEntries = sortedEntries;

  const isFirstPage = safeCurrentPage <= 1;
  const isLastPage = safeCurrentPage >= Math.max(totalPages, 1);

  const requestPageChange = React.useCallback(
    (nextPage) => {
      const clamped = Math.min(Math.max(nextPage, 1), Math.max(totalPages, 1));
      setRequestedPage(clamped);
      setCurrentPage(clamped);
    },
    [totalPages],
  );

  const handlePageSizeChange = React.useCallback(
    (event) => {
      const value = Number(event?.target?.value ?? DEFAULT_PAGE_SIZE);
      const candidate = Number.isFinite(value) ? Math.floor(value) : DEFAULT_PAGE_SIZE;
      const allowed = PAGE_SIZE_OPTIONS.includes(candidate) ? candidate : DEFAULT_PAGE_SIZE;
      if (allowed === pageSize) {
        return;
      }
      setPageSize(allowed);
      setRequestedPage(1);
      setCurrentPage(1);
    },
    [pageSize],
  );

  const handleSelectDungeon = React.useCallback((dungeonId) => {
    setSelectedDungeon((previous) => {
      const nextId =
        typeof dungeonId === 'string' || typeof dungeonId === 'number'
          ? String(dungeonId)
          : null;
      if (previous === nextId) {
        return previous;
      }
      return nextId;
    });
  }, []);

  const handleFirstPage = React.useCallback(() => {
    requestPageChange(1);
  }, [requestPageChange]);

  const handlePreviousPage = React.useCallback(() => {
    requestPageChange(safeCurrentPage - 1);
  }, [requestPageChange, safeCurrentPage]);

  const handleNextPage = React.useCallback(() => {
    requestPageChange(safeCurrentPage + 1);
  }, [requestPageChange, safeCurrentPage]);

  const handleLastPage = React.useCallback(() => {
    requestPageChange(totalPages);
  }, [requestPageChange, totalPages]);

  const handlePageInputChange = React.useCallback((event) => {
    const value = event?.target?.value ?? '';
    const digitsOnly = typeof value === 'string' ? value.replace(/[^0-9]/g, '') : '';
    setPageInputValue(digitsOnly);
  }, []);

  const commitPageInput = React.useCallback(() => {
    const trimmed = (pageInputValue || '').trim();
    if (trimmed.length === 0) {
      setPageInputValue(String(safeCurrentPage));
      return;
    }
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      setPageInputValue(String(safeCurrentPage));
      return;
    }
    const nextPage = Math.min(Math.max(Math.floor(numeric), 1), Math.max(totalPages, 1));
    requestPageChange(nextPage);
    setPageInputValue(String(nextPage));
  }, [pageInputValue, requestPageChange, safeCurrentPage, totalPages]);

  const handlePageInputBlur = React.useCallback(() => {
    commitPageInput();
  }, [commitPageInput]);

  const handlePageInputKeyDown = React.useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitPageInput();
      }
    },
    [commitPageInput],
  );

  const displayTitle = React.useMemo(() => capitaliseWords(pageTitle || ''), [pageTitle]);

  const sortedRegionOptions = React.useMemo(() => {
    const options = Array.isArray(regionOptions) ? regionOptions : [];
    if (options.length === 0) {
      return [];
    }
    const collator = new Intl.Collator(lang || undefined, { sensitivity: 'base' });
    return options
      .map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
      .filter((value) => value.length > 0)
      .sort((left, right) => {
        const leftLabel = translateRegion(t, left) || left;
        const rightLabel = translateRegion(t, right) || right;
        return collator.compare(leftLabel, rightLabel);
      });
  }, [regionOptions, t, lang]);

  const hasRegionData = sortedRegionOptions.length > 0;
  const regionPanelId = React.useMemo(() => `${mode}-region-filter`, [mode]);

  const selectedDungeonDetails = React.useMemo(() => {
    if (!selectedDungeon) {
      return null;
    }
    const selectedId = String(selectedDungeon);
    return (
      sortedDungeons.find((dungeon) => {
        if (!dungeon || typeof dungeon !== 'object') {
          return false;
        }
        const dungeonId =
          typeof dungeon.id === 'string' || typeof dungeon.id === 'number'
            ? String(dungeon.id)
            : '';
        return dungeonId === selectedId;
      }) || null
    );
  }, [selectedDungeon, sortedDungeons]);

  const selectedDungeonName = React.useMemo(() => {
    if (selectedDungeonDetails) {
      return getDungeonNameForLang(selectedDungeonDetails, lang);
    }
    if (!selectedDungeon) {
      return '';
    }
    return String(selectedDungeon);
  }, [selectedDungeonDetails, selectedDungeon, lang]);

  const selectedDungeonIconId = selectedDungeonDetails?.id ?? selectedDungeon ?? null;
  const selectedDungeonDisplayName = selectedDungeonName || t.dungeonSelectorEmpty;

  const hasMutationData =
    mutationOptions.type.length > 0 ||
    mutationOptions.promotion.length > 0 ||
    mutationOptions.curse.length > 0;
  const mutationPanelId = React.useMemo(() => `${mode}-mutation-filter`, [mode]);
  const dungeonPanelId = React.useMemo(() => `${mode}-dungeon-list`, [mode]);
  const simplePagination = (mode === 'score' || mode === 'time') && isMobileViewport;

  return (
    <main className="page leaderboard-page" aria-labelledby={`${mode}-title`}>
      <h1 id={`${mode}-title`} className="page-title title-with-icon">
        {showDungeonIconInTitle ? <DungeonIcon dungeonId={selectedDungeon} /> : null}
        <span>{displayTitle}</span>
      </h1>
      <div className="leaderboard-layout">
        <aside className="leaderboard-sidebar">
          <section className="leaderboard-sidebar-section">
            <button
              type="button"
              className="leaderboard-sidebar-toggle"
              aria-expanded={!isRegionCollapsed}
              aria-controls={regionPanelId}
              onClick={handleRegionPanelToggle}
            >
              <span className="leaderboard-sidebar-title" role="heading" aria-level="2">
                {t.regionFilterTitle}
              </span>
              <span className="leaderboard-sidebar-toggle-icon" aria-hidden="true" />
              <span className="visually-hidden">
                {isRegionCollapsed ? t.regionFilterToggleExpand : t.regionFilterToggleCollapse}
              </span>
            </button>
            <div
              id={regionPanelId}
              className="leaderboard-sidebar-content leaderboard-filter-panel"
              hidden={isRegionCollapsed}
              aria-hidden={isRegionCollapsed}
              style={isRegionCollapsed ? { display: 'none' } : undefined}
            >
              {regionLoading ? (
                <p className="leaderboard-status">{t.regionFilterLoading}</p>
              ) : null}
              {regionError ? (
                <p className="leaderboard-status error">{t.regionFilterError}</p>
              ) : null}
              {hasRegionData ? (
                <div className="region-filter-panel">
                  <div className="region-filter-list" role="group" aria-label={t.regionFilterTitle}>
                    {sortedRegionOptions.map((regionId) => {
                      const isActive = regionFilters.includes(regionId);
                      const regionLabel = translateRegion(t, regionId) || regionId;
                      const regionCode = typeof regionId === 'string' ? regionId : String(regionId || '');
                      return (
                        <button
                          key={regionId}
                          type="button"
                          className={`region-filter-button${isActive ? ' active' : ''}`}
                          onClick={() => handleRegionFilterToggle(regionId)}
                          aria-pressed={isActive}
                          title={regionLabel}
                          aria-label={regionLabel}
                        >
                          <span className="region-filter-button-code">{regionCode}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : !regionLoading ? (
                <p className="leaderboard-filter-empty">{t.regionFilterEmpty}</p>
              ) : null}
            </div>
          </section>
          <section className="leaderboard-sidebar-section">
            <button
              type="button"
              className="leaderboard-sidebar-toggle"
              aria-expanded={!isMutationCollapsed}
              aria-controls={mutationPanelId}
              onClick={handleMutationPanelToggle}
            >
              <span className="leaderboard-sidebar-title" role="heading" aria-level="2">
                {t.mutationFilterTitle}
              </span>
              <span className="leaderboard-sidebar-toggle-icon" aria-hidden="true" />
              <span className="visually-hidden">
                {isMutationCollapsed
                  ? t.mutationFilterToggleExpand
                  : t.mutationFilterToggleCollapse}
              </span>
            </button>
            <div
              id={mutationPanelId}
              className="leaderboard-sidebar-content leaderboard-filter-panel"
              hidden={isMutationCollapsed}
              aria-hidden={isMutationCollapsed}
              style={isMutationCollapsed ? { display: 'none' } : undefined}
            >
              {hasMutationData ? (
                <div className="leaderboard-filter-groups">
                  <div className="mutation-filter-group">
                    <h3 className="mutation-filter-group-title">{t.mutationFilterTypeLabel}</h3>
                    <div
                      className="mutation-filter-grid"
                      role="group"
                      aria-label={t.mutationFilterTypeLabel}
                    >
                      {mutationOptions.type.map((typeId) => {
                        const isActive = Array.isArray(mutationFilters.type)
                          ? mutationFilters.type.includes(typeId)
                          : false;
                        const iconSrc = getMutationIconSource('type', typeId);
                        return (
                          <button
                            key={typeId}
                            type="button"
                            className={
                              isActive
                                ? 'mutation-filter-option active'
                                : 'mutation-filter-option'
                            }
                            aria-pressed={isActive}
                            onClick={() => handleMutationFilterToggle('type', typeId)}
                            title={typeId}
                            aria-label={typeId}
                          >
                            {iconSrc ? (
                              <img
                                src={iconSrc}
                                alt=""
                                aria-hidden="true"
                                className="mutation-filter-option-icon"
                                loading="lazy"
                                decoding="async"
                                draggable="false"
                              />
                            ) : (
                              <span className="mutation-filter-option-fallback" aria-hidden="true">
                                {typeId?.charAt ? typeId.charAt(0) : ''}
                              </span>
                            )}
                            <span className="visually-hidden">{typeId}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mutation-filter-group">
                    <h3 className="mutation-filter-group-title">{t.mutationFilterPromotionLabel}</h3>
                    <div
                      className="mutation-filter-grid"
                      role="group"
                      aria-label={t.mutationFilterPromotionLabel}
                    >
                      {mutationOptions.promotion.map((promotionId) => {
                        const isActive = Array.isArray(mutationFilters.promotion)
                          ? mutationFilters.promotion.includes(promotionId)
                          : false;
                        const iconSrc = getMutationIconSource('promotion', promotionId);
                        return (
                          <button
                            key={promotionId}
                            type="button"
                            className={
                              isActive
                                ? 'mutation-filter-option active'
                                : 'mutation-filter-option'
                            }
                            aria-pressed={isActive}
                            onClick={() => handleMutationFilterToggle('promotion', promotionId)}
                            title={promotionId}
                            aria-label={promotionId}
                          >
                            {iconSrc ? (
                              <img
                                src={iconSrc}
                                alt=""
                                aria-hidden="true"
                                className="mutation-filter-option-icon"
                                loading="lazy"
                                decoding="async"
                                draggable="false"
                              />
                            ) : (
                              <span className="mutation-filter-option-fallback" aria-hidden="true">
                                {promotionId?.charAt ? promotionId.charAt(0) : ''}
                              </span>
                            )}
                            <span className="visually-hidden">{promotionId}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mutation-filter-group">
                    <h3 className="mutation-filter-group-title">{t.mutationFilterCurseLabel}</h3>
                    <div
                      className="mutation-filter-grid"
                      role="group"
                      aria-label={t.mutationFilterCurseLabel}
                    >
                      {mutationOptions.curse.map((curseId) => {
                        const isActive = Array.isArray(mutationFilters.curse)
                          ? mutationFilters.curse.includes(curseId)
                          : false;
                        const iconSrc = getMutationIconSource('curse', curseId);
                        return (
                          <button
                            key={curseId}
                            type="button"
                            className={
                              isActive
                                ? 'mutation-filter-option active'
                                : 'mutation-filter-option'
                            }
                            aria-pressed={isActive}
                            onClick={() => handleMutationFilterToggle('curse', curseId)}
                            title={curseId}
                            aria-label={curseId}
                          >
                            {iconSrc ? (
                              <img
                                src={iconSrc}
                                alt=""
                                aria-hidden="true"
                                className="mutation-filter-option-icon"
                                loading="lazy"
                                decoding="async"
                                draggable="false"
                              />
                            ) : (
                              <span className="mutation-filter-option-fallback" aria-hidden="true">
                                {curseId?.charAt ? curseId.charAt(0) : ''}
                              </span>
                            )}
                            <span className="visually-hidden">{curseId}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="leaderboard-filter-empty">{t.mutationFilterEmpty}</p>
              )}
            </div>
          </section>
          <section className="leaderboard-sidebar-section">
            <button
              type="button"
              className="leaderboard-sidebar-toggle"
              aria-expanded={!isDungeonCollapsed}
              aria-controls={dungeonPanelId}
              onClick={() => setIsDungeonCollapsed((previous) => !previous)}
            >
              <span className="leaderboard-sidebar-title" role="heading" aria-level="2">
                {t.dungeonSelectorTitle}
              </span>
              <span className="leaderboard-sidebar-toggle-icon" aria-hidden="true" />
              <span className="visually-hidden">
                {isDungeonCollapsed ? t.dungeonSelectorToggleExpand : t.dungeonSelectorToggleCollapse}
              </span>
            </button>
            <div id={dungeonPanelId} className="leaderboard-sidebar-content" hidden={isDungeonCollapsed}>
              {dungeonsLoading ? (
                <p className="leaderboard-status">{t.leaderboardLoading}</p>
              ) : dungeonsError ? (
                <p className="leaderboard-status error">{t.dungeonSelectorError}</p>
              ) : dungeons.length === 0 ? (
                <p className="leaderboard-status">{t.dungeonSelectorEmpty}</p>
              ) : (
                <div className="dungeon-selector-panel">
                  <div
                    className={
                      selectedDungeonDetails?.highlighted
                        ? 'dungeon-selected-display highlighted-glow'
                        : 'dungeon-selected-display'
                    }
                  >
                    <DungeonIcon dungeonId={selectedDungeonIconId} className="dungeon-selected-icon" />
                    <div className="dungeon-selected-text">
                      <span className="dungeon-selected-label">{t.dungeonSelectorCurrent}</span>
                      <span className="dungeon-selected-name">{selectedDungeonDisplayName}</span>
                    </div>
                  </div>
                  <div className="dungeon-grid" role="group" aria-label={t.dungeonSelectorTitle}>
                    {sortedDungeons.map((dungeon) => {
                      const displayName = getDungeonNameForLang(dungeon, lang);
                      const dungeonId =
                        typeof dungeon.id === 'string' || typeof dungeon.id === 'number'
                          ? String(dungeon.id)
                          : '';
                      const isActive = selectedDungeon === dungeonId;
                      const dungeonTitle = displayName || dungeonId || t.dungeonSelectorTitle;
                      const dungeonButtonClass = [
                        'dungeon-grid-button',
                        isActive ? 'active' : '',
                        dungeon?.highlighted ? 'highlighted-glow' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <button
                          key={dungeon.id}
                          type="button"
                          className={dungeonButtonClass}
                          onClick={() => handleSelectDungeon(dungeonId)}
                          aria-pressed={isActive}
                          title={dungeonTitle}
                          aria-label={dungeonTitle}
                        >
                          <DungeonIcon dungeonId={dungeon.id} className="dungeon-grid-button-icon" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </aside>
        <section className="leaderboard-results" aria-live="polite">
          {entriesLoading ? (
            <>
              {seasonCarousel}
              {weekFilterPanel}
              <p className="leaderboard-status">{t.leaderboardLoading}</p>
            </>
          ) : entriesError ? (
            <>
              {chartSection}
              {seasonCarousel}
              {weekFilterPanel}
              <p className="leaderboard-status error">{t.leaderboardError}</p>
            </>
          ) : sortedEntries.length === 0 ? (
            <>
              {chartSection}
              {seasonCarousel}
              {weekFilterPanel}
              <p className="leaderboard-status">{t.leaderboardNoResults}</p>
            </>
          ) : (
            <>
              {chartSection}
              {seasonCarousel}
              {weekFilterPanel}
              <ul className="leaderboard-list">
                {displayEntries.map((entry) => {
                  const regionLabel = entry.region ? translateRegion(t, entry.region) : '';
                  const weekDisplay = entry.week
                    ? typeof t.leaderboardWeekLabel === 'function'
                      ? t.leaderboardWeekLabel(entry.week)
                      : entry.week
                    : t.leaderboardUnknownWeek;
                  const valueDisplay = formatValue(entry.value, entry.raw);
                  const mutations = entry.mutations ?? extractMutationIds(entry.raw);
                  return (
                    <li key={entry.id} className="leaderboard-run">
                      <div className="leaderboard-run-header">
                        <div className="leaderboard-week-row">
                          <RankBadge
                            position={entry.position ?? entry.raw?.position}
                            label={t.individualRankHeader}
                            className="leaderboard-rank-badge"
                          />
                          {regionLabel ? (
                            <span className="leaderboard-region">[{regionLabel}]</span>
                          ) : null}
                          <span className="leaderboard-week">{weekDisplay}</span>
                        </div>
                        <span className="leaderboard-value">{valueDisplay}</span>
                      </div>
                      <ul className="leaderboard-player-grid">
                        {entry.players.length === 0 ? (
                          <li className="leaderboard-player">
                            <span className="leaderboard-player-name">{t.leaderboardUnknownPlayers}</span>
                          </li>
                        ) : (
                          entry.players.map((player, index) => {
                            const displayName =
                              player.playerName || player.displayName || t.leaderboardUnknownPlayer;
                            const tooltip = player.isAlt
                              ? player.mainName || player.tooltip || ''
                              : player.tooltip || '';
                            const nameClass = `leaderboard-player-name${player.isAlt ? ' player-alt-name' : ''}`;
                            const nameContent = player.isAlt ? (
                              <>
                                <em>{displayName}</em>
                                <span className="player-alt-indicator" aria-hidden="true">
                                  *
                                </span>
                              </>
                            ) : (
                              displayName
                            );
                            const playerKey = player.id ?? player.displayName ?? `player-${index}`;
                            return (
                              <li key={playerKey} className="leaderboard-player">
                                {player.id ? (
                                  <Link
                                    to={`/player/${encodeURIComponent(player.id)}`}
                                    className="leaderboard-player-link"
                                    title={tooltip || undefined}
                                  >
                                    <span className={nameClass}>{nameContent}</span>
                                  </Link>
                                ) : (
                                  <span className={nameClass} title={tooltip || undefined}>
                                    {nameContent}
                                  </span>
                                )}
                              </li>
                            );
                          })
                        )}
                      </ul>
                      <MutationIconList
                        {...mutations}
                        className="leaderboard-mutation-icons"
                      />
                    </li>
                  );
                })}
              </ul>
              <nav
                className="leaderboard-pagination"
                aria-label={t.leaderboardPaginationLabel}
                data-simple={simplePagination ? 'true' : undefined}
              >
                {simplePagination ? null : (
                  <div className="leaderboard-page-size">
                    <label className="leaderboard-page-size-label" htmlFor={`${mode}-page-size`}>
                      {t.leaderboardPageSizeLabel}
                    </label>
                    <select
                      id={`${mode}-page-size`}
                      className="leaderboard-page-size-select"
                      value={pageSize}
                      onChange={handlePageSizeChange}
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  className="leaderboard-pagination-button"
                  onClick={handleFirstPage}
                  disabled={isFirstPage}
                  aria-label={t.leaderboardPaginationFirst}
                  title={t.leaderboardPaginationFirst}
                >
                  <span aria-hidden="true">{'<<'}</span>
                </button>
                <button
                  type="button"
                  className="leaderboard-pagination-button"
                  onClick={handlePreviousPage}
                  disabled={isFirstPage}
                  aria-label={t.leaderboardPaginationPrevious}
                  title={t.leaderboardPaginationPrevious}
                >
                  <span aria-hidden="true">{'<'}</span>
                </button>
                {simplePagination ? null : (
                  <div className="leaderboard-pagination-status">
                    <span className="leaderboard-pagination-page-label">
                      {t.leaderboardPaginationPageLabel}
                    </span>
                    <label className="leaderboard-pagination-input" htmlFor={`${mode}-page-input`}>
                      <span className="visually-hidden">{t.leaderboardPaginationInputLabel}</span>
                      <input
                        id={`${mode}-page-input`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pageInputValue}
                        onChange={handlePageInputChange}
                        onBlur={handlePageInputBlur}
                        onKeyDown={handlePageInputKeyDown}
                      />
                    </label>
                    <span className="leaderboard-pagination-separator">{t.leaderboardPaginationSeparator}</span>
                    <span className="leaderboard-pagination-total">{Math.max(totalPages, 1)}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="leaderboard-pagination-button"
                  onClick={handleNextPage}
                  disabled={isLastPage}
                  aria-label={t.leaderboardPaginationNext}
                  title={t.leaderboardPaginationNext}
                >
                  <span aria-hidden="true">{'>'}</span>
                </button>
                <button
                  type="button"
                  className="leaderboard-pagination-button"
                  onClick={handleLastPage}
                  disabled={isLastPage}
                  aria-label={t.leaderboardPaginationLast}
                  title={t.leaderboardPaginationLast}
                >
                  <span aria-hidden="true">{'>>'}</span>
                </button>
              </nav>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
