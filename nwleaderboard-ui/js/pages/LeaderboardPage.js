import { LangContext } from '../i18n.js';
import HomeMenu from '../components/HomeMenu.js';
import { getDungeonNameForLang, normaliseDungeons, sortDungeons } from '../dungeons.js';

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

  return (
    <main className="page leaderboard-page" aria-labelledby={`${mode}-title`}>
      <h1 id={`${mode}-title`} className="page-title">
        {pageTitle}
      </h1>
      <HomeMenu />
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
                return (
                  <li key={dungeon.id}>
                    <button
                      type="button"
                      className={
                          dungeon.id === selectedDungeon
                            ? 'dungeon-button active'
                            : 'dungeon-button'
                      }
                      onClick={() => handleSelectDungeon(dungeon.id)}
                    >
                      {displayName}
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
            <ul className="leaderboard-list">
              {sortedEntries.map((entry) => {
                const weekDisplay = entry.week || t.leaderboardUnknownWeek;
                const valueDisplay = formatValue(entry.value, entry.raw);
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
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
