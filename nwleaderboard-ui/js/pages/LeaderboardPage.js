import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function normalisePlayers(entry) {
  const { players, members, team, squad, group, party } = entry || {};
  const source =
    players ?? members ?? team ?? squad ?? group ?? party ?? entry?.playerNames ?? entry?.names ?? entry?.users;
  if (!source) {
    return [];
  }
  if (Array.isArray(source)) {
    return source
      .map((value) => (typeof value === 'string' ? value.trim() : value))
      .filter((value) => Boolean(value && String(value).length))
      .map((value) => String(value));
  }
  if (typeof source === 'string') {
    return source
      .split(/[,;\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function deriveWeek(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const { week, period, season, date, label, title, range } = entry;
  return week ?? period ?? season ?? date ?? label ?? title ?? range ?? '';
}

function normaliseDungeons(data) {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((dungeon, index) => {
      if (!dungeon || typeof dungeon !== 'object') {
        return null;
      }
      const identifier =
        dungeon.id ??
        dungeon.slug ??
        dungeon.code ??
        dungeon.key ??
        dungeon.identifier ??
        dungeon.ref ??
        dungeon.name ??
        index;
      if (identifier === undefined || identifier === null) {
        return null;
      }
      const id = String(identifier);
      const labelCandidate =
        dungeon.name ??
        dungeon.label ??
        dungeon.title ??
        dungeon.displayName ??
        dungeon.slug ??
        dungeon.code ??
        dungeon.identifier;
      const name = labelCandidate ? String(labelCandidate) : id;
      return { id, name };
    })
    .filter(Boolean);
}

export default function LeaderboardPage({
  mode,
  pageTitle,
  getValue,
  formatValue,
  getSortValue,
  sortDirection = 'desc',
}) {
  const { t } = React.useContext(LangContext);
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
        if (normalised.length === 0) {
          setSelectedDungeon(null);
        } else {
          setSelectedDungeon((previous) => {
            if (previous && normalised.some((dungeon) => dungeon.id === previous)) {
              return previous;
            }
            return normalised[0].id;
          });
        }
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') {
          return;
        }
        console.error('Unable to load dungeons', error);
        setDungeonsError(true);
        setDungeons([]);
        setSelectedDungeon(null);
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
      <div className="leaderboard-layout">
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
                const playersText = entry.players.length
                  ? entry.players.join(', ')
                  : t.leaderboardUnknownPlayers;
                const weekDisplay = entry.week || t.leaderboardUnknownWeek;
                const valueDisplay = formatValue(entry.value, entry.raw);
                return (
                  <li key={entry.id} className="leaderboard-row">
                    <span className="leaderboard-week">{weekDisplay}</span>
                    <span className="leaderboard-players">{playersText}</span>
                    <span className="leaderboard-value">{valueDisplay}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
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
              {dungeons.map((dungeon) => (
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
                    {dungeon.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
