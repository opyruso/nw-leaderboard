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
import { sortSeasons } from '../seasons.js';
import { capitaliseWords } from '../text.js';
import { ThemeContext } from '../theme.js';

const { Link } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = Object.freeze([25, 50, 100]);
const MUTATION_FILTER_KEYS = ['type', 'promotion', 'curse'];
const FILTER_STORAGE_PREFIX = 'nwleaderboard:filters:';

function createEmptyMutationFilters() {
  return { type: [], promotion: [], curse: [] };
}

function loadStoredFilters(mode) {
  if (!mode || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(`${FILTER_STORAGE_PREFIX}${mode}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
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
    return { mutation, regions, dungeon: dungeon || null };
  } catch (error) {
    return null;
  }
}

function saveStoredFilters(mode, mutationFilters, regionFilters, dungeonId) {
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
    };
    window.localStorage.setItem(`${FILTER_STORAGE_PREFIX}${mode}`, JSON.stringify(payload));
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
  const [selectedSeasonId, setSelectedSeasonId] = React.useState(null);
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
  const [regionOptions, setRegionOptions] = React.useState([]);
  const [regionLoading, setRegionLoading] = React.useState(false);
  const [regionError, setRegionError] = React.useState(false);
  const [isDungeonCollapsed, setIsDungeonCollapsed] = React.useState(false);
  const [isRegionCollapsed, setIsRegionCollapsed] = React.useState(false);
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

  React.useEffect(() => {
    if (storedFilters?.mutation) {
      mutationFiltersInitialisedRef.current = true;
      hasUserAdjustedMutationFiltersRef.current = true;
    }
    if (Array.isArray(storedFilters?.regions) && storedFilters.regions.length > 0) {
      regionFiltersInitialisedRef.current = true;
      hasUserAdjustedRegionFiltersRef.current = true;
    }
  }, [storedFilters]);

  const handleMutationPanelToggle = React.useCallback(() => {
    setIsMutationCollapsed((previous) => !previous);
  }, []);

  const handleRegionPanelToggle = React.useCallback(() => {
    setIsRegionCollapsed((previous) => !previous);
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

    if (selectedSeasonId !== null && selectedSeasonId !== undefined) {
      params.set('seasonId', String(selectedSeasonId));
    }

    return params;
  }, [
    selectedDungeon,
    mutationFilters,
    mutationOptions,
    regionFilters,
    regionOptions,
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
        setSeasons(sorted);
        setSelectedSeasonId((previous) => {
          const availableIds = sorted.map((season) => String(season.id));
          if (seasonInitialised) {
            if (previous === null || previous === undefined) {
              return previous;
            }
            const previousId = String(previous);
            const hasPrevious = availableIds.includes(previousId);
            if (hasPrevious) {
              return previousId;
            }
            const [firstSeason] = sorted;
            return firstSeason ? String(firstSeason.id) : null;
          }
          const [first] = sorted;
          return first ? String(first.id) : null;
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
  }, [selectedDungeon, mutationFilters, regionFilters, selectedSeasonId]);

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
    setSelectedSeasonId((previous) => {
      const next = value === null || value === undefined ? null : String(value);
      if (previous === next) {
        return previous;
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    saveStoredFilters(mode, mutationFilters, regionFilters, selectedDungeon);
  }, [mode, mutationFilters, regionFilters, selectedDungeon]);

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

    const hasTypeFilter = typeFilters.length > 0;
    const hasPromotionFilter = promotionFilters.length > 0;
    const hasCurseFilter = curseFilters.length > 0;
    const hasRegionFilter = regionFilterValues.length > 0;

    if (!hasTypeFilter && !hasPromotionFilter && !hasCurseFilter && !hasRegionFilter) {
      return entries;
    }

    return entries.filter((entry) => {
      const mutations = entry?.mutations ?? extractMutationIds(entry?.raw);
      const typeId = mutations?.typeId ? String(mutations.typeId) : '';
      const promotionId = mutations?.promotionId ? String(mutations.promotionId) : '';
      const curseId = mutations?.curseId ? String(mutations.curseId) : '';

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
  }, [entries, mutationFilters, regionFilters]);

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

    const weeks = Array.isArray(chartData?.weeks) ? chartData.weeks : [];
    if (weeks.length === 0) {
      return null;
    }

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

    if (points.length === 0) {
      return null;
    }

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

  const seasonCarousel = (
    <SeasonCarousel
      label={t.seasonSelectorLabel}
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

  const hasMutationData =
    mutationOptions.type.length > 0 ||
    mutationOptions.promotion.length > 0 ||
    mutationOptions.curse.length > 0;
  const mutationPanelId = React.useMemo(() => `${mode}-mutation-filter`, [mode]);
  const dungeonPanelId = React.useMemo(() => `${mode}-dungeon-list`, [mode]);

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
                      return (
                        <button
                          key={regionId}
                          type="button"
                          className={`region-filter-button${isActive ? ' active' : ''}`}
                          onClick={() => handleRegionFilterToggle(regionId)}
                          aria-pressed={isActive}
                        >
                          {translateRegion(t, regionId)}
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
                <ul className="dungeon-list">
                  {sortedDungeons.map((dungeon) => {
                    const displayName = getDungeonNameForLang(dungeon, lang);
                    const dungeonId =
                      typeof dungeon.id === 'string' || typeof dungeon.id === 'number'
                        ? String(dungeon.id)
                        : '';
                    const isActive = selectedDungeon === dungeonId;
                    return (
                      <li key={dungeon.id}>
                        <button
                          type="button"
                          className={isActive ? 'dungeon-button active' : 'dungeon-button'}
                          onClick={() => handleSelectDungeon(dungeonId)}
                        >
                          <span className="dungeon-button-content">
                            <DungeonIcon dungeonId={dungeon.id} className="dungeon-button-icon" />
                            <span className="dungeon-button-label">{displayName}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </aside>
        <section className="leaderboard-results" aria-live="polite">
          {entriesLoading ? (
            <>
              {seasonCarousel}
              <p className="leaderboard-status">{t.leaderboardLoading}</p>
            </>
          ) : entriesError ? (
            <>
              {seasonCarousel}
              <p className="leaderboard-status error">{t.leaderboardError}</p>
            </>
          ) : sortedEntries.length === 0 ? (
            <>
              {seasonCarousel}
              <p className="leaderboard-status">{t.leaderboardNoResults}</p>
            </>
          ) : (
            <>
              {chartMemo ? (
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
              ) : null}
              {seasonCarousel}
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
                              player.displayName || player.playerName || t.leaderboardUnknownPlayer;
                            const playerKey = player.id ?? player.displayName ?? `player-${index}`;
                            return (
                              <li key={playerKey} className="leaderboard-player">
                                {player.id ? (
                                  <Link
                                    to={`/player/${encodeURIComponent(player.id)}`}
                                    className="leaderboard-player-link"
                                    title={player.tooltip || undefined}
                                  >
                                    {displayName}
                                  </Link>
                                ) : (
                                  <span className="leaderboard-player-name" title={player.tooltip || undefined}>
                                    {displayName}
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
              >
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
