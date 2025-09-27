import { LangContext } from '../i18n.js';
import ChartCanvas from '../components/ChartCanvas.js';
import DungeonIcon from '../components/DungeonIcon.js';
import MutationIconList from '../components/MutationIconList.js';
import RankBadge from '../components/RankBadge.js';
import { getDungeonNameForLang, normaliseDungeons, sortDungeons } from '../dungeons.js';
import {
  extractMutationIds,
  getAllMutationCurseIds,
  getAllMutationPromotionIds,
  getAllMutationTypeIds,
  getMutationIconSources,
} from '../mutations.js';
import { formatPlayerLinkProps } from '../playerNames.js';
import { capitaliseWords } from '../text.js';

const { Link } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const PAGE_SIZE = 50;
const MUTATION_FILTER_KEYS = ['type', 'promotion', 'curse'];

function createEmptyMutationFilters() {
  return { type: [], promotion: [], curse: [] };
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
  const [dungeons, setDungeons] = React.useState([]);
  const [dungeonsLoading, setDungeonsLoading] = React.useState(false);
  const [dungeonsError, setDungeonsError] = React.useState(false);
  const [selectedDungeon, setSelectedDungeon] = React.useState(null);
  const [entries, setEntries] = React.useState([]);
  const [entriesLoading, setEntriesLoading] = React.useState(false);
  const [entriesError, setEntriesError] = React.useState(false);
  const [mutationFilters, setMutationFilters] = React.useState(() => createEmptyMutationFilters());
  const [isDungeonCollapsed, setIsDungeonCollapsed] = React.useState(false);
  const [isMutationCollapsed, setIsMutationCollapsed] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInputValue, setPageInputValue] = React.useState('1');
  const mutationIconCache = React.useRef(new Map());

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
      setSelectedDungeon((previous) => (previous === null ? previous : null));
      return;
    }
    setSelectedDungeon((previous) => {
      if (previous && dungeons.some((dungeon) => dungeon.id === previous)) {
        return previous;
      }
      const [first] = sortDungeons(dungeons, lang);
      return first ? first.id : null;
    });
  }, [dungeons, lang]);

  React.useEffect(() => {
    if (!selectedDungeon) {
      setEntries([]);
      setEntriesLoading(false);
      setEntriesError(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setEntriesLoading(true);
    setEntriesError(false);

    const url = `${API_BASE_URL}/leaderboard/${mode}?dungeonId=${encodeURIComponent(selectedDungeon)}`;

    fetch(url, { signal: controller.signal })
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
        const safeArray = Array.isArray(data) ? data : [];
        const normalisedEntries = safeArray.map((entry, index) => {
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
  }, [mode, selectedDungeon, getValue]);

  const sortedDungeons = React.useMemo(() => sortDungeons(dungeons, lang), [dungeons, lang]);

  React.useEffect(() => {
    setMutationFilters(createEmptyMutationFilters());
  }, [selectedDungeon]);

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

  React.useEffect(() => {
    setMutationFilters((previous) => {
      if (!previous || typeof previous !== 'object') {
        return previous;
      }

      let changed = false;
      const next = { ...previous };

      MUTATION_FILTER_KEYS.forEach((key) => {
        const available = Array.isArray(mutationOptions[key]) ? mutationOptions[key] : [];
        const currentValues = Array.isArray(next[key]) ? next[key] : [];
        if (currentValues.length === 0) {
          if (!Array.isArray(next[key])) {
            next[key] = [];
            changed = true;
          }
          return;
        }
        const filteredValues = currentValues.filter((value) => available.includes(value));
        if (filteredValues.length !== currentValues.length) {
          next[key] = filteredValues;
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [mutationOptions]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedDungeon, mutationFilters]);

  const handleMutationFilterToggle = React.useCallback((key, value) => {
    if (!MUTATION_FILTER_KEYS.includes(key)) {
      return;
    }

    setMutationFilters((previous) => {
      const safePrevious =
        previous && typeof previous === 'object' ? previous : createEmptyMutationFilters();
      const currentValues = Array.isArray(safePrevious[key]) ? safePrevious[key] : [];
      const hasValue = currentValues.includes(value);
      let nextValues;
      if (hasValue) {
        nextValues = currentValues.filter((item) => item !== value);
      } else {
        nextValues = currentValues.concat(value);
      }

      if (nextValues.length === currentValues.length && hasValue) {
        return safePrevious;
      }
      if (!hasValue && nextValues.length === currentValues.length) {
        return safePrevious;
      }

      return { ...safePrevious, [key]: nextValues };
    });
  }, []);

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

    const hasTypeFilter = typeFilters.length > 0;
    const hasPromotionFilter = promotionFilters.length > 0;
    const hasCurseFilter = curseFilters.length > 0;

    if (!hasTypeFilter && !hasPromotionFilter && !hasCurseFilter) {
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
      return true;
    });
  }, [entries, mutationFilters]);

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
    if (!chartConfig || typeof chartConfig.extractValue !== 'function') {
      return null;
    }

    const points = filteredEntries
      .map((entry) => {
        const numericValue = chartConfig.extractValue(entry);
        if (!Number.isFinite(numericValue)) {
          return null;
        }
        const weekKey = entry.week || '';
        const numericWeek = Number(weekKey);
        const hasNumericWeek = Number.isFinite(numericWeek);
        const label =
          typeof chartConfig.formatWeek === 'function'
            ? chartConfig.formatWeek(weekKey, hasNumericWeek ? numericWeek : null)
            : formatWeekLabel(weekKey);
        return {
          value: numericValue,
          weekKey,
          label,
          numericWeek: hasNumericWeek ? numericWeek : null,
        };
      })
      .filter(Boolean);

    if (points.length === 0) {
      return null;
    }

    const groupMap = new Map();
    const groups = [];

    points.forEach((point, index) => {
      const key = point.weekKey || '';
      let group = groupMap.get(key);
      if (!group) {
        group = {
          key,
          label: point.label,
          numericWeek: point.numericWeek,
          order: index,
          values: [],
        };
        groupMap.set(key, group);
        groups.push(group);
      }
      group.values.push(point.value);
    });

    groups.sort((a, b) => {
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

    const aggregated = [];
    const bestValues = [];
    const worstValues = [];

    groups.forEach((group) => {
      const values = group.values.filter((value) => Number.isFinite(value));
      if (values.length === 0) {
        bestValues.push(null);
        worstValues.push(null);
        return;
      }
      values.forEach((value) => aggregated.push(value));
      const sortedValues = values.slice().sort((left, right) => left - right);
      if (chartConfig.isValueLowerBetter) {
        bestValues.push(sortedValues[0]);
        worstValues.push(sortedValues[sortedValues.length - 1]);
      } else {
        bestValues.push(sortedValues[sortedValues.length - 1]);
        worstValues.push(sortedValues[0]);
      }
    });

    if (aggregated.length === 0) {
      return null;
    }

    const average = aggregated.reduce((total, value) => total + value, 0) / aggregated.length;
    const labels = groups.map((group) => group.label || formatWeekLabel(group.key));
    const averageValues = groups.map(() => average);

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
    if (chartConfig.averageLabel) {
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

    const numericValues = [...bestValues, ...worstValues, average].filter((value) =>
      Number.isFinite(value),
    );
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
          labels: { usePointStyle: true, color: 'inherit' },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              if (!items || items.length === 0) {
                return '';
              }
              const index = items[0].dataIndex;
              const group = groups[index];
              if (!group) {
                return '';
              }
              if (typeof chartConfig.formatTooltipTitle === 'function') {
                return chartConfig.formatTooltipTitle(group.key, group.numericWeek);
              }
              if (!group.key) {
                return t.leaderboardUnknownWeek;
              }
              if (group.numericWeek !== null && typeof t.playerWeekLabel === 'function') {
                return t.playerWeekLabel(group.numericWeek);
              }
              return group.key;
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
  }, [chartConfig, filteredEntries, formatWeekLabel, t]);

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

  const sortedEntriesLength = sortedEntries.length;
  const totalPages = Math.max(1, Math.ceil(sortedEntriesLength / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  React.useEffect(() => {
    setCurrentPage((previous) => {
      const clamped = Math.min(Math.max(previous, 1), totalPages);
      return clamped;
    });
  }, [totalPages]);

  React.useEffect(() => {
    setPageInputValue((previous) => {
      const nextValue = String(safeCurrentPage);
      return previous === nextValue ? previous : nextValue;
    });
  }, [safeCurrentPage]);

  const paginatedEntries = React.useMemo(() => {
    if (sortedEntriesLength === 0) {
      return [];
    }
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return sortedEntries.slice(startIndex, startIndex + PAGE_SIZE);
  }, [safeCurrentPage, sortedEntries, sortedEntriesLength]);

  const isFirstPage = safeCurrentPage <= 1;
  const isLastPage = safeCurrentPage >= totalPages;

  const handleSelectDungeon = React.useCallback((dungeonId) => {
    setSelectedDungeon(dungeonId);
  }, []);

  const handleFirstPage = React.useCallback(() => {
    setCurrentPage(1);
  }, []);

  const handlePreviousPage = React.useCallback(() => {
    setCurrentPage((previous) => Math.max(1, previous - 1));
  }, []);

  const handleNextPage = React.useCallback(() => {
    setCurrentPage((previous) => Math.min(totalPages, previous + 1));
  }, [totalPages]);

  const handleLastPage = React.useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

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
    const nextPage = Math.min(Math.max(Math.floor(numeric), 1), totalPages);
    setCurrentPage(nextPage);
    setPageInputValue(String(nextPage));
  }, [pageInputValue, safeCurrentPage, totalPages]);

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
              aria-expanded={!isMutationCollapsed}
              aria-controls={mutationPanelId}
              onClick={() => setIsMutationCollapsed((previous) => !previous)}
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
                    const isActive = dungeon.id === selectedDungeon;
                    return (
                      <li key={dungeon.id}>
                        <button
                          type="button"
                          className={isActive ? 'dungeon-button active' : 'dungeon-button'}
                          onClick={() => handleSelectDungeon(dungeon.id)}
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
            <p className="leaderboard-status">{t.leaderboardLoading}</p>
          ) : entriesError ? (
            <p className="leaderboard-status error">{t.leaderboardError}</p>
          ) : sortedEntries.length === 0 ? (
            <p className="leaderboard-status">{t.leaderboardNoResults}</p>
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
              <ul className="leaderboard-list">
                {paginatedEntries.map((entry) => {
                  const weekDisplay = entry.week || t.leaderboardUnknownWeek;
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
                <button
                  type="button"
                  className="leaderboard-pagination-button"
                  onClick={handleFirstPage}
                  disabled={isFirstPage}
                >
                  {t.leaderboardPaginationFirst}
                </button>
                <button
                  type="button"
                  className="leaderboard-pagination-button"
                  onClick={handlePreviousPage}
                  disabled={isFirstPage}
                >
                  {t.leaderboardPaginationPrevious}
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
                  <span className="leaderboard-pagination-total">{totalPages}</span>
                </div>
                <button
                  type="button"
                  className="leaderboard-pagination-button"
                  onClick={handleNextPage}
                  disabled={isLastPage}
                >
                  {t.leaderboardPaginationNext}
                </button>
                <button
                  type="button"
                  className="leaderboard-pagination-button"
                  onClick={handleLastPage}
                  disabled={isLastPage}
                >
                  {t.leaderboardPaginationLast}
                </button>
              </nav>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
