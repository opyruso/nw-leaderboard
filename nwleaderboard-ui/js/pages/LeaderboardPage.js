import { LangContext } from '../i18n.js';
import ChartCanvas from '../components/ChartCanvas.js';
import DungeonIcon from '../components/DungeonIcon.js';
import MutationIconList from '../components/MutationIconList.js';
import { getDungeonNameForLang, normaliseDungeons, sortDungeons } from '../dungeons.js';
import { extractMutationIds } from '../mutations.js';
import { capitaliseWords } from '../text.js';

const { Link } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function normalisePlayers(entry) {
  const { players, members, team, squad, group, party } = entry || {};
  const source =
    players ?? members ?? team ?? squad ?? group ?? party ?? entry?.playerNames ?? entry?.names ?? entry?.users;
  if (!source) {
    return [];
  }

  const collected = [];
  const pushPlayer = (id, name) => {
    const safeId = id !== undefined && id !== null ? String(id) : null;
    const safeName = typeof name === 'string' ? name.trim() : '';
    if (!safeId && !safeName) {
      return;
    }
    collected.push({ id: safeId, name: safeName });
  };

  if (Array.isArray(source)) {
    source.forEach((value) => {
      if (!value) {
        return;
      }
      if (typeof value === 'string') {
        pushPlayer(null, value);
        return;
      }
      if (typeof value === 'object') {
        const id =
          value.id ??
          value.playerId ??
          value.player_id ??
          value.id_player ??
          value.identifier ??
          value.ref ??
          value.key ??
          null;
        const name =
          value.name ??
          value.playerName ??
          value.player_name ??
          value.label ??
          value.displayName ??
          value.username ??
          value.fullName ??
          value.text ??
          '';
        pushPlayer(id, name);
      }
    });
  } else if (typeof source === 'string') {
    source
      .split(/[,;\n]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => pushPlayer(null, value));
  }

  if (collected.length === 0) {
    return [];
  }

  const unique = [];
  const seen = new Set();
  collected.forEach((player) => {
    const key = player.id ? `id:${player.id}` : player.name ? `name:${player.name.toLowerCase()}` : null;
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(player);
  });
  return unique;
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
          const id = entry?.id ?? entry?.entryId ?? `${week || 'entry'}-${index}`;
          return {
            id: String(id),
            week: week ? String(week) : '',
            players,
            value,
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

    const points = entries
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
  }, [chartConfig, entries, formatWeekLabel, t]);

  const sortedEntries = React.useMemo(() => {
    if (entries.length === 0) {
      return [];
    }
    const copy = entries.slice();
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
  }, [entries, getSortValue, sortDirection]);

  const handleSelectDungeon = React.useCallback((dungeonId) => {
    setSelectedDungeon(dungeonId);
  }, []);

  const displayTitle = React.useMemo(() => capitaliseWords(pageTitle || ''), [pageTitle]);

  return (
    <main className="page leaderboard-page" aria-labelledby={`${mode}-title`}>
      <h1 id={`${mode}-title`} className="page-title title-with-icon">
        {showDungeonIconInTitle ? <DungeonIcon dungeonId={selectedDungeon} /> : null}
        <span>{displayTitle}</span>
      </h1>
      <div className="leaderboard-layout">
        <aside className="leaderboard-sidebar">
          <h2 className="leaderboard-sidebar-title">{t.dungeonSelectorTitle}</h2>
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
                {sortedEntries.map((entry) => {
                  const weekDisplay = entry.week || t.leaderboardUnknownWeek;
                  const valueDisplay = formatValue(entry.value, entry.raw);
                  const mutations = extractMutationIds(entry.raw);
                  return (
                    <li key={entry.id} className="leaderboard-run">
                      <div className="leaderboard-run-header">
                        <span className="leaderboard-week">{weekDisplay}</span>
                        <span className="leaderboard-value">{valueDisplay}</span>
                      </div>
                      <ul className="leaderboard-player-grid">
                        {entry.players.length === 0 ? (
                          <li className="leaderboard-player">
                            <span className="leaderboard-player-name">{t.leaderboardUnknownPlayers}</span>
                          </li>
                        ) : (
                          entry.players.map((player, index) => {
                            const displayName = player.name || t.leaderboardUnknownPlayer;
                            const playerKey = player.id ?? player.name ?? `player-${index}`;
                            return (
                              <li key={playerKey} className="leaderboard-player">
                                {player.id ? (
                                  <Link
                                    to={`/player/${encodeURIComponent(player.id)}`}
                                    className="leaderboard-player-link"
                                  >
                                    {displayName}
                                  </Link>
                                ) : (
                                  <span className="leaderboard-player-name">{displayName}</span>
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
            </>
          )}
        </section>
      </div>
    </main>
  );
}
