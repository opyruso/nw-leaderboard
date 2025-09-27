import { LangContext } from '../i18n.js';
import { normaliseRegionList, translateRegion } from '../regions.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

export default function ContributeStats() {
  const { t } = React.useContext(LangContext);
  const [stats, setStats] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const fallbackRegions = React.useMemo(() => normaliseRegionList(), []);
  const [regions, setRegions] = React.useState(fallbackRegions);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const applyRegions = (list) => {
      if (!active) {
        return;
      }
      const normalised = normaliseRegionList(list, fallbackRegions);
      setRegions(normalised);
    };

    if (!API_BASE_URL) {
      applyRegions(fallbackRegions);
    } else {
      fetch(`${API_BASE_URL}/contributor/regions`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load regions: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          applyRegions(data);
        })
        .catch((fetchError) => {
          if (!active || fetchError.name === 'AbortError') {
            return;
          }
          console.warn('Unable to load region list', fetchError);
          applyRegions(fallbackRegions);
        });
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [fallbackRegions]);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    fetch(`${API_BASE_URL}/contributor/runs/weekly`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .catch(() => null)
            .then((data) => {
              const message = data && typeof data.message === 'string' ? data.message : '';
              throw new Error(message || `Failed to load statistics: ${response.status}`);
            });
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        if (!Array.isArray(data)) {
          setStats([]);
          return;
        }
        const normaliseCounts = (raw) => {
          if (!raw || typeof raw !== 'object') {
            return {};
          }
          const result = {};
          Object.entries(raw).forEach(([key, value]) => {
            if (!key) {
              return;
            }
            const regionId = key.trim().toUpperCase();
            if (!regionId) {
              return;
            }
            const numeric = Number(value);
            result[regionId] = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
          });
          return result;
        };
        const prepared = data
          .map((entry) => {
            const weekValue =
              entry && entry.week !== undefined && entry.week !== null
                ? Number.parseInt(entry.week, 10)
                : null;
            const week = Number.isFinite(weekValue) && weekValue > 0 ? weekValue : null;
            if (week === null) {
              return null;
            }
            const scoreRuns = normaliseCounts(entry?.score_runs ?? entry?.scoreRuns);
            const timeRuns = normaliseCounts(entry?.time_runs ?? entry?.timeRuns);
            return {
              week,
              scoreByRegion: scoreRuns,
              timeByRegion: timeRuns,
            };
          })
          .filter(Boolean)
          .sort((left, right) => right.week - left.week);
        setStats(prepared);
      })
      .catch((fetchError) => {
        if (!active || fetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load contributor statistics', fetchError);
        setError(fetchError && fetchError.message ? fetchError.message : t.contributeStatsError);
        setStats([]);
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
  }, [t]);

  const regionColumns = React.useMemo(
    () => normaliseRegionList(
      stats.reduce((acc, entry) => {
        if (entry && entry.scoreByRegion) {
          acc.push(...Object.keys(entry.scoreByRegion));
        }
        if (entry && entry.timeByRegion) {
          acc.push(...Object.keys(entry.timeByRegion));
        }
        return acc;
      }, [...regions]),
      fallbackRegions,
    ),
    [regions, stats, fallbackRegions],
  );

  const formatCount = (value) => (Number.isFinite(value) ? value.toLocaleString() : '0');

  return (
    <section className="contribute-stats">
      <p className="page-description">{t.contributeStatsDescription}</p>
      <div className="contribute-stats-table-container" aria-live="polite">
        {loading ? <p className="form-hint">{t.contributeStatsLoading}</p> : null}
        {error ? (
          <p className="form-message error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error ? (
          stats.length === 0 ? (
            <p className="form-hint">{t.contributeStatsEmpty}</p>
          ) : (
            <table className="contribute-stats-table">
              <thead>
                <tr>
                  <th scope="col">{t.contributeStatsWeek}</th>
                  {regionColumns.map((region) => {
                    const regionName = translateRegion(t, region);
                    const scoreHeader =
                      typeof t.contributeStatsScoreRunsRegion === 'function'
                        ? t.contributeStatsScoreRunsRegion(regionName)
                        : `${regionName} ${t.contributeStatsScoreRuns}`;
                    const timeHeader =
                      typeof t.contributeStatsTimeRunsRegion === 'function'
                        ? t.contributeStatsTimeRunsRegion(regionName)
                        : `${regionName} ${t.contributeStatsTimeRuns}`;
                    return (
                      <React.Fragment key={region}>
                        <th scope="col">{scoreHeader}</th>
                        <th scope="col">{timeHeader}</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {stats.map((entry) => (
                  <tr key={entry.week}>
                    <th scope="row">{entry.week}</th>
                    {regionColumns.map((region) => (
                      <React.Fragment key={`${entry.week}-${region}`}>
                        <td>{formatCount(entry.scoreByRegion?.[region] ?? 0)}</td>
                        <td>{formatCount(entry.timeByRegion?.[region] ?? 0)}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>
    </section>
  );
}
