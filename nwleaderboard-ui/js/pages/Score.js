import LeaderboardPage from './LeaderboardPage.js';
import { LangContext } from '../i18n.js';
import { capitaliseWords } from '../text.js';

const { useLocation, useNavigate, useParams } = ReactRouterDOM;

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

function formatScore(value) {
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

export default function Score() {
  const { t } = React.useContext(LangContext);
  const pageTitle = capitaliseWords(t.scoreTitle || '');
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const dungeonIdFromParams = params?.dungeonId ? String(params.dungeonId) : null;

  React.useEffect(() => {
    if (location.pathname.startsWith('/score')) {
      const suffix = dungeonIdFromParams ? `/${encodeURIComponent(dungeonIdFromParams)}` : '';
      navigate(`/leaderboard/score${suffix}`, { replace: true });
    }
  }, [location.pathname, dungeonIdFromParams, navigate]);

  const handleSelectedDungeonChange = React.useCallback(
    (dungeonId, reason = 'auto') => {
      if (reason === 'sync') {
        return;
      }

      const basePath = '/leaderboard/score';

      if (!dungeonId) {
        if (location.pathname !== basePath) {
          navigate(basePath, { replace: reason !== 'user' });
        }
        return;
      }

      const targetPath = `${basePath}/${encodeURIComponent(dungeonId)}`;
      if (location.pathname === targetPath) {
        return;
      }

      navigate(targetPath, { replace: reason !== 'user' });
    },
    [location.pathname, navigate],
  );

  const chartConfig = React.useMemo(
    () => ({
      chartTitle: t.leaderboardScoreChartTitle,
      extractValue: (entry) => parseScoreValue(entry.value),
      formatValue: (value) => formatScore(value),
      bestLabel: t.leaderboardChartBestScore,
      worstLabel: t.leaderboardChartWorstScore,
      averageLabel: t.leaderboardChartAverageScore,
      yAxisLabel: t.leaderboardChartScoreAxis,
      xAxisLabel: t.leaderboardChartWeekAxis,
      ariaLabel: t.leaderboardScoreChartAria,
      isValueLowerBetter: false,
    }),
    [t],
  );

  const getValue = React.useCallback((entry) => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    if (entry.score !== undefined && entry.score !== null) {
      return entry.score;
    }
    if (entry.value !== undefined && entry.value !== null) {
      return entry.value;
    }
    if (entry.points !== undefined && entry.points !== null) {
      return entry.points;
    }
    return null;
  }, []);

  const formatValue = React.useCallback((value) => formatScore(value), []);

  const getSortValue = React.useCallback((entry) => parseScoreValue(entry.value), []);

  return (
    <LeaderboardPage
      mode="score"
      pageTitle={pageTitle}
      selectedDungeonId={dungeonIdFromParams}
      onSelectedDungeonChange={handleSelectedDungeonChange}
      getValue={getValue}
      formatValue={formatValue}
      getSortValue={getSortValue}
      sortDirection="desc"
      chartConfig={chartConfig}
      showDungeonIconInTitle={false}
    />
  );
}
