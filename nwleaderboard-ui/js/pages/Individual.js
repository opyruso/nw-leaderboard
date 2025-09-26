import { LangContext } from '../i18n.js';
import HomeMenu from '../components/HomeMenu.js';
import { capitaliseWords } from '../text.js';
import { useDocumentTitle } from '../pageTitle.js';

const { Link } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

const MODES = ['global', 'score', 'time'];

function formatPoints(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0';
  }
  return value.toLocaleString();
}

export default function Individual() {
  const { t } = React.useContext(LangContext);
  const [mode, setMode] = React.useState('global');
  const [entries, setEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const baseTitle = React.useMemo(() => capitaliseWords(t.individualTitle || ''), [t]);
  const activeModeLabel = React.useMemo(() => {
    if (mode === 'score') {
      return capitaliseWords(t.individualModeScore || '');
    }
    if (mode === 'time') {
      return capitaliseWords(t.individualModeTime || '');
    }
    return capitaliseWords(t.individualModeGlobal || '');
  }, [mode, t]);

  const documentTitle = React.useMemo(() => {
    if (activeModeLabel) {
      return `${baseTitle} – ${activeModeLabel}`;
    }
    return baseTitle;
  }, [baseTitle, activeModeLabel]);

  useDocumentTitle(documentTitle);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    const url = `${API_BASE_URL}/leaderboard/individual?mode=${encodeURIComponent(mode)}`;

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ranking: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const safeArray = Array.isArray(data) ? data : [];
        setEntries(safeArray);
      })
      .catch((fetchError) => {
        if (!active || fetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load individual ranking', fetchError);
        setError(true);
        setEntries([]);
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
  }, [mode]);

  const handleModeChange = React.useCallback((value) => {
    setMode(value);
  }, []);

  return (
    <main className="page individual-page" aria-labelledby="individual-title">
      <h1 id="individual-title" className="page-title">
        {t.individualTitle}
      </h1>
      <HomeMenu />
      <p className="page-description">{t.individualDescription}</p>

      <div className="individual-controls" role="group" aria-label={t.individualModeLabel}>
        {MODES.map((value) => {
          const isActive = mode === value;
          const label =
            value === 'global'
              ? t.individualModeGlobal
              : value === 'score'
              ? t.individualModeScore
              : t.individualModeTime;
          return (
            <button
              key={value}
              type="button"
              className={isActive ? 'individual-mode-button active' : 'individual-mode-button'}
              onClick={() => handleModeChange(value)}
              aria-pressed={isActive}
            >
              {label}
            </button>
          );
        })}
      </div>

      <section className="individual-results" aria-live="polite">
        {loading ? (
          <p className="individual-status">{t.individualLoading}</p>
        ) : error ? (
          <p className="individual-status error">{t.individualError}</p>
        ) : entries.length === 0 ? (
          <p className="individual-status">{t.individualEmpty}</p>
        ) : (
          <div className="individual-table-container">
            <table className="individual-table">
              <thead>
                <tr>
                  <th scope="col">{t.individualRankHeader}</th>
                  <th scope="col">{t.individualPlayerHeader}</th>
                  <th scope="col" className="numeric-cell">
                    {mode === 'score'
                      ? t.individualScorePointsHeader
                      : mode === 'time'
                      ? t.individualTimePointsHeader
                      : t.individualPointsHeader}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const rank = index + 1;
                  const playerId = entry?.playerId;
                  const rawName = typeof entry?.playerName === 'string' ? entry.playerName.trim() : '';
                  const displayName = rawName || t.leaderboardUnknownPlayer;
                  const basePoints = Number.isFinite(entry?.points) ? entry.points : 0;
                  const scorePoints = Number.isFinite(entry?.scorePoints) ? entry.scorePoints : 0;
                  const timePoints = Number.isFinite(entry?.timePoints) ? entry.timePoints : 0;
                  const pointsForMode =
                    mode === 'score' ? scorePoints : mode === 'time' ? timePoints : basePoints;
                  return (
                    <tr key={playerId ?? `${displayName}-${rank}`}>
                      <th scope="row">{rank}</th>
                      <td>
                        {playerId ? (
                          <Link
                            to={`/player/${encodeURIComponent(String(playerId))}`}
                            className="individual-player-link"
                          >
                            {displayName}
                          </Link>
                        ) : (
                          <span className="individual-player-name">{displayName}</span>
                        )}
                      </td>
                      <td className="numeric-cell">{formatPoints(pointsForMode)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
