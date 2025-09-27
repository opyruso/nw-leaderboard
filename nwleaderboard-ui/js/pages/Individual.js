import { LangContext } from '../i18n.js';
import { translateRegion, extractRegionId } from '../regions.js';
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
  const [selectedRegion, setSelectedRegion] = React.useState('');

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

  const handleRegionChange = React.useCallback((value) => {
    setSelectedRegion((previous) => (previous === value ? previous : value));
  }, []);

  const regionOptions = React.useMemo(() => {
    const unique = new Set();
    entries.forEach((entry) => {
      const regionId = extractRegionId(entry);
      if (regionId) {
        unique.add(regionId);
      }
    });
    if (selectedRegion) {
      unique.add(selectedRegion);
    }
    const sorted = Array.from(unique).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' }),
    );
    return [''].concat(sorted);
  }, [entries, selectedRegion]);

  const displayedEntries = React.useMemo(() => {
    if (!selectedRegion) {
      return entries;
    }
    const target = selectedRegion.trim().toUpperCase();
    return entries.filter((entry) => extractRegionId(entry) === target);
  }, [entries, selectedRegion]);

  return (
    <main className="page individual-page" aria-labelledby="individual-title">
      <h1 id="individual-title" className="page-title">
        {t.individualTitle}
      </h1>
      <p className="page-description">{t.individualDescription}</p>

      <div className="individual-controls">
        <div
          className="individual-filter-group individual-region-filters"
          role="group"
          aria-label={t.individualRegionFiltersLabel || 'Region filters'}
        >
          <span className="individual-filter-legend">
            {t.individualRegionFiltersLabel || 'Region'}
          </span>
          {regionOptions.map((value) => {
            const isActive = selectedRegion === value;
            const label = value
              ? translateRegion(t, value)
              : t.regionFilterAll || 'All';
            return (
              <button
                key={value || 'all'}
                type="button"
                className={`leaderboard-pagination-button individual-filter-button${
                  isActive ? ' active' : ''
                }`}
                onClick={() => handleRegionChange(value)}
                aria-pressed={isActive}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div
          className="individual-filter-group individual-mode-filters"
          role="group"
          aria-label={t.individualModeLabel}
        >
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
                className={`leaderboard-pagination-button individual-filter-button${
                  isActive ? ' active' : ''
                }`}
                onClick={() => handleModeChange(value)}
                aria-pressed={isActive}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <section className="individual-results" aria-live="polite">
        {loading ? (
          <p className="individual-status">{t.individualLoading}</p>
        ) : error ? (
          <p className="individual-status error">{t.individualError}</p>
        ) : entries.length === 0 ? (
          <p className="individual-status">{t.individualEmpty}</p>
        ) : displayedEntries.length === 0 ? (
          <p className="individual-status">{t.individualEmpty}</p>
        ) : (
          <div className="individual-table-container">
            <table className="individual-table">
              <thead>
                <tr>
                  <th scope="col">{t.individualRankHeader}</th>
                  <th scope="col">{t.individualRegionHeader || 'Region'}</th>
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
                {displayedEntries.map((entry, index) => {
                  const rank = index + 1;
                  const playerId = entry?.playerId;
                  const rawName = typeof entry?.playerName === 'string' ? entry.playerName.trim() : '';
                  const displayName = rawName || t.leaderboardUnknownPlayer;
                  const basePoints = Number.isFinite(entry?.points) ? entry.points : 0;
                  const scorePoints = Number.isFinite(entry?.scorePoints) ? entry.scorePoints : 0;
                  const timePoints = Number.isFinite(entry?.timePoints) ? entry.timePoints : 0;
                  const pointsForMode =
                    mode === 'score' ? scorePoints : mode === 'time' ? timePoints : basePoints;
                  const regionId = extractRegionId(entry);
                  const regionLabel = regionId ? translateRegion(t, regionId) : '—';
                  return (
                    <tr key={playerId ?? `${displayName}-${rank}`}>
                      <th scope="row">{rank}</th>
                      <td className="individual-region-cell">{regionLabel}</td>
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
