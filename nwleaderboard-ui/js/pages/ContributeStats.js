import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

export default function ContributeStats() {
  const { t } = React.useContext(LangContext);
  const [stats, setStats] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

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
        setStats(
          data
            .map((entry) => {
              const weekValue =
                entry && entry.week !== undefined && entry.week !== null
                  ? Number.parseInt(entry.week, 10)
                  : null;
              const scoreValue =
                entry && entry.score_runs !== undefined && entry.score_runs !== null
                  ? Number(entry.score_runs)
                  : 0;
              const timeValue =
                entry && entry.time_runs !== undefined && entry.time_runs !== null
                  ? Number(entry.time_runs)
                  : 0;
              return {
                week: Number.isFinite(weekValue) ? weekValue : null,
                scoreRuns: Number.isFinite(scoreValue) ? scoreValue : 0,
                timeRuns: Number.isFinite(timeValue) ? timeValue : 0,
              };
            })
            .filter((entry) => entry.week !== null)
        );
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
                  <th scope="col">{t.contributeStatsScoreRuns}</th>
                  <th scope="col">{t.contributeStatsTimeRuns}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((entry) => (
                  <tr key={entry.week}>
                    <th scope="row">{entry.week}</th>
                    <td>{entry.scoreRuns}</td>
                    <td>{entry.timeRuns}</td>
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
