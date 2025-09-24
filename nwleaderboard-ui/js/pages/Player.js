import { LangContext } from '../i18n.js';
import { getDungeonNameForLang, sortDungeons } from '../dungeons.js';
import HomeMenu from '../components/HomeMenu.js';
import ChartCanvas from '../components/ChartCanvas.js';

const { Link, useNavigate, useParams } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function parseScoreValue(value) {
  if (value === undefined || value === null || value === '') {
    return Number.NaN;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) {
      return Number.NaN;
    }
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return Number.NaN;
}

function formatScoreValue(value) {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'bigint') {
    return Number(value).toLocaleString();
  }
  const numeric = parseScoreValue(value);
  if (!Number.isNaN(numeric)) {
    return numeric.toLocaleString();
  }
  return String(value);
}

function toSeconds(value) {
  if (value === undefined || value === null || value === '') {
    return Number.NaN;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const stringValue = String(value).trim();
  if (!stringValue) {
    return Number.NaN;
  }
  const timeParts = stringValue.split(':');
  if (timeParts.length >= 2 && timeParts.length <= 3 && timeParts.every((part) => part.trim().length > 0)) {
    const parts = timeParts.map((part) => Number(part));
    if (parts.every((part) => Number.isFinite(part))) {
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      if (parts.length === 3) {
        [hours, minutes, seconds] = parts;
      } else {
        [minutes, seconds] = parts;
      }
      return hours * 3600 + minutes * 60 + seconds;
    }
  }
  const numeric = Number(stringValue);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return Number.NaN;
}

function formatTimeValue(value) {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  if (typeof value === 'string') {
    const timeParts = value.split(':');
    if (timeParts.length >= 2 && timeParts.length <= 3) {
      const padded = timeParts.map((part) => part.padStart(2, '0'));
      while (padded.length < 3) {
        padded.unshift('00');
      }
      return `${padded[0]}:${padded[1]}:${padded[2]}`;
    }
  }
  const seconds = toSeconds(value);
  if (Number.isNaN(seconds)) {
    return String(value);
  }
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function Player() {
  const { t, lang } = React.useContext(LangContext);
  const { playerId } = useParams();
  const navigate = useNavigate();
  const normalisedPlayerId = React.useMemo(() => {
    if (playerId === undefined || playerId === null) {
      return '';
    }
    if (typeof playerId === 'string') {
      return playerId.trim();
    }
    return String(playerId);
  }, [playerId]);
  const hasPlayerId = normalisedPlayerId.length > 0;
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState(false);
  const searchInputId = React.useId();

  React.useEffect(() => {
    if (hasPlayerId) {
      setSearchTerm('');
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
    }
  }, [hasPlayerId]);

  React.useEffect(() => {
    if (hasPlayerId) {
      return undefined;
    }

    const trimmed = searchTerm.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(false);
    setSearchResults([]);

    fetch(`${API_BASE_URL}/player?q=${encodeURIComponent(trimmed)}&limit=8`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to search players: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }

        const list = Array.isArray(data) ? data : [];
        const mapped = [];
        const seen = new Set();

        list.forEach((entry) => {
          if (!entry) {
            return;
          }

          const idCandidate =
            entry.id ?? entry.playerId ?? entry.player_id ?? entry.id_player ?? null;
          const nameCandidate =
            entry.name ??
            entry.playerName ??
            entry.player_name ??
            entry.label ??
            entry.displayName ??
            entry.username ??
            entry.fullName ??
            '';

          const id = idCandidate !== undefined && idCandidate !== null ? String(idCandidate) : null;
          const name = typeof nameCandidate === 'string' ? nameCandidate.trim() : '';

          if (!id || !name) {
            return;
          }

          const key = `id:${id}`;
          if (seen.has(key)) {
            return;
          }
          seen.add(key);
          mapped.push({ id, name });
        });

        setSearchResults(mapped);
        setSearchLoading(false);
      })
      .catch((searchErrorInstance) => {
        if (!active || searchErrorInstance.name === 'AbortError') {
          return;
        }
        console.error('Unable to search players', searchErrorInstance);
        setSearchError(true);
        setSearchLoading(false);
        setSearchResults([]);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [hasPlayerId, searchTerm]);

  React.useEffect(() => {
    if (!hasPlayerId) {
      setProfile(null);
      setError(false);
      setLoading(false);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setProfile(null);

    fetch(`${API_BASE_URL}/player/${encodeURIComponent(normalisedPlayerId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load player: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        setProfile(data);
        setLoading(false);
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') {
          return;
        }
        console.error('Unable to load player profile', error);
        setError(true);
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [hasPlayerId, normalisedPlayerId]);

  const preparedDungeons = React.useMemo(() => {
    if (!profile || !Array.isArray(profile.dungeons)) {
      return [];
    }
    const base = profile.dungeons.map((entry, index) => ({
      id: entry?.dungeonId !== undefined && entry?.dungeonId !== null ? String(entry.dungeonId) : `dungeon-${index}`,
      names: entry?.names || {},
      fallbackName: entry?.fallbackName || '',
      bestScore: entry?.bestScore ?? null,
      bestScoreWeek: entry?.bestScoreWeek ?? null,
      bestTime: entry?.bestTime ?? null,
      bestTimeWeek: entry?.bestTimeWeek ?? null,
      order: index,
    }));
    return sortDungeons(base, lang);
  }, [profile, lang]);

  const scoreChartData = React.useMemo(() => {
    if (preparedDungeons.length === 0) {
      return null;
    }
    const labels = preparedDungeons.map((dungeon) => getDungeonNameForLang(dungeon, lang));
    const values = preparedDungeons.map((dungeon) => {
      const numeric = parseScoreValue(dungeon.bestScore);
      return Number.isFinite(numeric) ? numeric : null;
    });
    const numericValues = values.filter((value) => Number.isFinite(value));
    if (numericValues.length === 0) {
      return null;
    }
    const minValue = Math.min(...numericValues);
    const maxValue = Math.max(...numericValues);
    const span = Math.abs(maxValue - minValue);
    const padding = span === 0 ? Math.max(1, Math.abs(maxValue || 0) * 0.05) : span * 0.1;
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: false,
          suggestedMin: minValue - padding,
          suggestedMax: maxValue + padding,
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
          angleLines: { color: 'rgba(148, 163, 184, 0.18)' },
          ticks: {
            backdropColor: 'transparent',
            color: 'rgba(148, 163, 184, 0.85)',
            callback: (value) => formatScoreValue(value),
          },
          pointLabels: {
            color: 'inherit',
            font: { size: 12 },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const parsed = context.parsed?.r;
              return `${context.label}: ${formatScoreValue(parsed)}`;
            },
          },
        },
      },
    };
    const data = {
      labels,
      datasets: [
        {
          label: t.playerScoreRadarDataset,
          data: values,
          borderColor: '#7c5cff',
          backgroundColor: 'rgba(124, 92, 255, 0.18)',
          pointBackgroundColor: '#7c5cff',
          pointBorderColor: '#7c5cff',
          pointRadius: 3,
        },
      ],
    };
    return { data, options };
  }, [preparedDungeons, lang, t]);

  const timeChartData = React.useMemo(() => {
    if (preparedDungeons.length === 0) {
      return null;
    }
    const labels = preparedDungeons.map((dungeon) => getDungeonNameForLang(dungeon, lang));
    const values = preparedDungeons.map((dungeon) => {
      const numeric = toSeconds(dungeon.bestTime);
      return Number.isFinite(numeric) ? numeric : null;
    });
    const numericValues = values.filter((value) => Number.isFinite(value));
    if (numericValues.length === 0) {
      return null;
    }
    const minValue = Math.min(...numericValues);
    const maxValue = Math.max(...numericValues);
    const span = Math.abs(maxValue - minValue);
    const padding = span === 0 ? Math.max(1, Math.abs(maxValue || 0) * 0.05) : span * 0.1;
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: false,
          reverse: true,
          suggestedMin: minValue - padding,
          suggestedMax: maxValue + padding,
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
          angleLines: { color: 'rgba(148, 163, 184, 0.18)' },
          ticks: {
            backdropColor: 'transparent',
            color: 'rgba(148, 163, 184, 0.85)',
            callback: (value) => formatTimeValue(value),
          },
          pointLabels: {
            color: 'inherit',
            font: { size: 12 },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const parsed = context.parsed?.r;
              return `${context.label}: ${formatTimeValue(parsed)}`;
            },
          },
        },
      },
    };
    const data = {
      labels,
      datasets: [
        {
          label: t.playerTimeRadarDataset,
          data: values,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.18)',
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#38bdf8',
          pointRadius: 3,
        },
      ],
    };
    return { data, options };
  }, [preparedDungeons, lang, t]);

  const playerDisplayName = React.useMemo(() => {
    if (profile && typeof profile.playerName === 'string') {
      const trimmed = profile.playerName.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return '';
  }, [profile]);

  const playerIdentifier = React.useMemo(() => {
    if (profile && profile.playerId !== undefined && profile.playerId !== null) {
      return String(profile.playerId);
    }
    if (hasPlayerId && normalisedPlayerId) {
      return normalisedPlayerId;
    }
    return '';
  }, [profile, hasPlayerId, normalisedPlayerId]);

  const handleSearchChange = React.useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  const trimmedSearch = React.useMemo(() => searchTerm.trim(), [searchTerm]);

  const handleSearchSubmit = React.useCallback(
    (event) => {
      event.preventDefault();
      if (!trimmedSearch) {
        return;
      }
      if (searchResults.length > 0) {
        navigate(`/player/${encodeURIComponent(searchResults[0].id)}`);
        return;
      }
      if (/^\d+$/.test(trimmedSearch)) {
        navigate(`/player/${encodeURIComponent(trimmedSearch)}`);
      }
    },
    [navigate, searchResults, trimmedSearch],
  );

  const showSearchResults =
    !searchLoading && !searchError && trimmedSearch.length >= 2 && searchResults.length > 0;
  const showSearchNoResults =
    !searchLoading && !searchError && trimmedSearch.length >= 2 && searchResults.length === 0;

  const heading = !hasPlayerId
    ? t.playerBrowseTitle
    : profile?.playerName
    ? profile.playerName
    : loading
    ? t.playerLoadingTitle
    : t.playerNotFoundTitle;

  const renderWeek = (week) => {
    const numeric = Number(week);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    if (typeof t.playerWeekLabel === 'function') {
      return t.playerWeekLabel(numeric);
    }
    return `${t.playerWeekLabel || 'Week'} ${numeric}`;
  };

  return (
    <main className="page player-page" aria-labelledby="player-title">
      <h1 id="player-title" className="page-title">
        {heading}
      </h1>
      <HomeMenu />
      <section className="player-dungeon-section" aria-live="polite">
        {hasPlayerId && (playerDisplayName || playerIdentifier) ? (
          <header className="player-profile-header">
            <h2 className="player-profile-name">
              {playerDisplayName
                || (playerIdentifier
                  ? typeof t.playerIdLabel === 'function'
                    ? t.playerIdLabel(playerIdentifier)
                    : `ID #${playerIdentifier}`
                  : '')}
            </h2>
            {playerDisplayName && playerIdentifier ? (
              <p className="player-profile-identifier">
                {typeof t.playerIdLabel === 'function'
                  ? t.playerIdLabel(playerIdentifier)
                  : `ID #${playerIdentifier}`}
              </p>
            ) : null}
          </header>
        ) : null}
        {!hasPlayerId ? (
          <div className="player-search-container">
            <p className="leaderboard-status">{t.playerBrowsePrompt}</p>
            <form
              className="player-search-form"
              onSubmit={handleSearchSubmit}
              role="search"
              aria-label={t.playerSearchLabel || undefined}
            >
              <label className="player-search-label" htmlFor={searchInputId}>
                {t.playerSearchLabel}
              </label>
              <input
                id={searchInputId}
                className="player-search-input"
                type="search"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={t.playerSearchPlaceholder}
                autoComplete="off"
                spellCheck="false"
              />
              {t.playerSearchHint ? (
                <p className="player-search-hint">{t.playerSearchHint}</p>
              ) : null}
            </form>
            {searchLoading ? (
              <p className="player-search-status">{t.playerSearchLoading}</p>
            ) : searchError ? (
              <p className="player-search-status error">{t.playerSearchError}</p>
            ) : showSearchNoResults ? (
              <p className="player-search-status">{t.playerSearchNoResults}</p>
            ) : showSearchResults ? (
              <ul className="player-search-results">
                {searchResults.map((player) => {
                  const label =
                    typeof t.playerSearchOpenProfile === 'function'
                      ? t.playerSearchOpenProfile(player.name)
                      : undefined;
                  const identifierLabel =
                    typeof t.playerIdLabel === 'function'
                      ? t.playerIdLabel(player.id)
                      : `ID #${player.id}`;
                  return (
                    <li key={player.id} className="player-search-result">
                      <Link
                        className="player-search-result-link"
                        to={`/player/${encodeURIComponent(player.id)}`}
                        aria-label={label}
                      >
                        <span className="player-search-result-name">{player.name}</span>
                        <span className="player-search-result-id">{identifierLabel}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : loading ? (
          <p className="leaderboard-status">{t.playerLoading}</p>
        ) : error ? (
          <p className="leaderboard-status error">{t.playerError}</p>
        ) : preparedDungeons.length === 0 ? (
          <p className="leaderboard-status">{t.playerNoRuns}</p>
        ) : (
          <>
            {scoreChartData || timeChartData ? (
              <div className="player-chart-grid">
                {scoreChartData ? (
                  <section className="player-chart-card">
                    <h2 className="player-chart-title">{t.playerScoreRadarTitle}</h2>
                    <div className="player-chart-body">
                      <ChartCanvas
                        type="radar"
                        data={scoreChartData.data}
                        options={scoreChartData.options}
                        ariaLabel={t.playerScoreRadarAria}
                        className="player-chart-canvas"
                      />
                    </div>
                  </section>
                ) : null}
                {timeChartData ? (
                  <section className="player-chart-card">
                    <h2 className="player-chart-title">{t.playerTimeRadarTitle}</h2>
                    <div className="player-chart-body">
                      <ChartCanvas
                        type="radar"
                        data={timeChartData.data}
                        options={timeChartData.options}
                        ariaLabel={t.playerTimeRadarAria}
                        className="player-chart-canvas"
                      />
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
            <ul className="player-dungeon-list">
              {preparedDungeons.map((dungeon) => {
                const name = getDungeonNameForLang(dungeon, lang);
                const hasScore = dungeon.bestScore !== null && dungeon.bestScore !== undefined;
                const hasTime = dungeon.bestTime !== null && dungeon.bestTime !== undefined;
                const scoreWeekLabel = renderWeek(dungeon.bestScoreWeek);
                const timeWeekLabel = renderWeek(dungeon.bestTimeWeek);
                return (
                  <li key={dungeon.id} className="player-dungeon-card">
                    <h2 className="player-dungeon-name">{name}</h2>
                    <dl className="player-dungeon-stats">
                      <div className="player-dungeon-stat">
                        <dt>{t.playerBestScore}</dt>
                        <dd>
                          {hasScore ? (
                            <>
                              <span className="player-dungeon-value">{formatScoreValue(dungeon.bestScore)}</span>
                              {scoreWeekLabel ? (
                                <span className="player-dungeon-week">{scoreWeekLabel}</span>
                              ) : null}
                            </>
                          ) : (
                            <span className="player-dungeon-empty">{t.playerNoScore}</span>
                          )}
                        </dd>
                      </div>
                      <div className="player-dungeon-stat">
                        <dt>{t.playerBestTime}</dt>
                        <dd>
                          {hasTime ? (
                            <>
                              <span className="player-dungeon-value">{formatTimeValue(dungeon.bestTime)}</span>
                              {timeWeekLabel ? (
                                <span className="player-dungeon-week">{timeWeekLabel}</span>
                              ) : null}
                            </>
                          ) : (
                            <span className="player-dungeon-empty">{t.playerNoTime}</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

