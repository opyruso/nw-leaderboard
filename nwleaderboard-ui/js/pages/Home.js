import { LangContext } from '../i18n.js';
import HomeMenu from '../components/HomeMenu.js';
import DungeonIcon from '../components/DungeonIcon.js';
import {
  deriveFallbackName,
  getDungeonNameForLang,
  normaliseDungeonNames,
  sortDungeons,
  toPositiveInteger,
} from '../dungeons.js';
import { capitaliseWords } from '../text.js';

const { Link } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function normalisePlayers(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }
  const normalised = [];
  const seen = new Set();
  players.forEach((player, index) => {
    if (!player) {
      return;
    }
    const idCandidate =
      player.id ??
      player.playerId ??
      player.player_id ??
      player.id_player ??
      player.identifier ??
      null;
    const nameCandidate =
      player.name ??
      player.playerName ??
      player.player_name ??
      player.displayName ??
      player.username ??
      player.fullName ??
      '';
    const name = typeof nameCandidate === 'string' ? nameCandidate.trim() : '';
    const id = idCandidate !== undefined && idCandidate !== null ? String(idCandidate) : null;
    const key = id ? `id:${id}` : name ? `name:${name.toLowerCase()}` : `index:${index}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    normalised.push({ id, name });
  });
  return normalised;
}

function normaliseMetric(metric) {
  if (!metric || typeof metric !== 'object') {
    return null;
  }
  const value = metric.value ?? metric.score ?? metric.time ?? metric.points ?? null;
  const week = metric.week ?? metric.period ?? metric.season ?? null;
  const players = normalisePlayers(metric.players);
  return {
    value: Number.isFinite(value) ? value : toPositiveInteger(value),
    week: toPositiveInteger(week),
    players,
  };
}

function normaliseHighlight(entry, index) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const identifier =
    entry.dungeon_id ?? entry.dungeonId ?? entry.id ?? entry.slug ?? entry.code ?? entry.identifier ?? index;
  if (identifier === undefined || identifier === null) {
    return null;
  }
  const id = String(identifier);
  const names = normaliseDungeonNames(entry);
  const fallbackName = deriveFallbackName(entry, names, id);
  if (!names.en && fallbackName) {
    names.en = fallbackName;
  }
  const playerCount = toPositiveInteger(entry.player_count ?? entry.playerCount);
  const score = normaliseMetric(entry.best_score ?? entry.bestScore);
  const time = normaliseMetric(entry.best_time ?? entry.bestTime);
  return {
    id,
    names,
    fallbackName,
    order: index,
    playerCount,
    score,
    time,
  };
}

function formatScore(value) {
  if (value === undefined || value === null) {
    return '—';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  const numeric = Number.parseFloat(value);
  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString();
  }
  return String(value);
}

function formatTime(seconds) {
  if (seconds === undefined || seconds === null) {
    return '—';
  }
  const numeric = Number.isFinite(seconds) ? seconds : Number.parseFloat(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '—';
  }
  const total = Math.round(numeric);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function Home() {
  const { t, lang } = React.useContext(LangContext);
  const [highlights, setHighlights] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const pageTitle = capitaliseWords(t.leaderboardTitle || '');

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    fetch(`${API_BASE_URL}/leaderboard/highlights`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load highlights: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const list = Array.isArray(data) ? data : [];
        const normalised = list
          .map((entry, index) => normaliseHighlight(entry, index))
          .filter(Boolean);
        setHighlights(normalised);
      })
      .catch((fetchError) => {
        if (!active || fetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load highlights', fetchError);
        setError(true);
        setHighlights([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const sortedHighlights = React.useMemo(
    () => sortDungeons(highlights, lang),
    [highlights, lang],
  );

  return (
    <main className="page" aria-labelledby="home-title">
      <h1 id="home-title" className="page-title title-with-icon">
        <span>{pageTitle}</span>
      </h1>
      <HomeMenu />
      <section className="highlight-section" aria-live="polite">
        {loading ? (
          <p className="highlight-status">{t.highlightLoading ?? t.leaderboardLoading}</p>
        ) : error ? (
          <p className="highlight-status error">{t.highlightError ?? t.leaderboardError}</p>
        ) : sortedHighlights.length === 0 ? (
          <p className="highlight-status">{t.highlightEmpty ?? t.leaderboardEmpty}</p>
        ) : (
          <ul className="highlight-list">
            {sortedHighlights.map((highlight) => {
              const dungeonName = getDungeonNameForLang(highlight, lang);
              const score = highlight.score;
              const time = highlight.time;
              const scoreValue = score ? formatScore(score.value) : t.highlightNoScore;
              const timeValue = time ? formatTime(time.value) : t.highlightNoTime;
              const scoreWeek = score && score.week ? score.week : null;
              const timeWeek = time && time.week ? time.week : null;
              return (
                <li key={highlight.id} className="highlight-item">
                  <header className="highlight-header">
                    <h2 className="highlight-title title-with-icon">
                      <DungeonIcon dungeonId={highlight.id} />
                      <span>{dungeonName}</span>
                    </h2>
                    {highlight.playerCount ? (
                      <span className="highlight-meta">
                        {typeof t.contributeDungeonExpectedPlayers === 'function'
                          ? t.contributeDungeonExpectedPlayers(highlight.playerCount)
                          : `${t.contributeDungeonExpectedPlayers ?? ''} ${highlight.playerCount}`.trim()}
                      </span>
                    ) : null}
                  </header>
                  <div className="highlight-metrics">
                    <div className="highlight-metric">
                      <span className="highlight-metric-label">{t.highlightScoreLabel ?? t.playerBestScore}</span>
                      <span className="highlight-metric-value">{scoreValue}</span>
                      {scoreWeek ? (
                        <span className="highlight-metric-week">
                          {typeof t.playerWeekLabel === 'function'
                            ? t.playerWeekLabel(scoreWeek)
                            : `${t.highlightWeekLabel ?? 'Week'} ${scoreWeek}`}
                        </span>
                      ) : null}
                      {score && score.players.length ? (
                        <ul className="highlight-player-list">
                          {score.players.map((player, index) => {
                            const name = player.name || t.leaderboardUnknownPlayer;
                            const key = player.id ?? `${highlight.id}-score-${index}`;
                            return (
                              <li key={key} className="highlight-player">
                                {player.id ? (
                                  <Link to={`/player/${encodeURIComponent(player.id)}`} className="highlight-player-link">
                                    {name}
                                  </Link>
                                ) : (
                                  <span className="highlight-player-name">{name}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                    <div className="highlight-metric">
                      <span className="highlight-metric-label">{t.highlightTimeLabel ?? t.playerBestTime}</span>
                      <span className="highlight-metric-value">{timeValue}</span>
                      {timeWeek ? (
                        <span className="highlight-metric-week">
                          {typeof t.playerWeekLabel === 'function'
                            ? t.playerWeekLabel(timeWeek)
                            : `${t.highlightWeekLabel ?? 'Week'} ${timeWeek}`}
                        </span>
                      ) : null}
                      {time && time.players.length ? (
                        <ul className="highlight-player-list">
                          {time.players.map((player, index) => {
                            const name = player.name || t.leaderboardUnknownPlayer;
                            const key = player.id ?? `${highlight.id}-time-${index}`;
                            return (
                              <li key={key} className="highlight-player">
                                {player.id ? (
                                  <Link to={`/player/${encodeURIComponent(player.id)}`} className="highlight-player-link">
                                    {name}
                                  </Link>
                                ) : (
                                  <span className="highlight-player-name">{name}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
