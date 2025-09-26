import LeaderboardPage from './LeaderboardPage.js';
import { LangContext } from '../i18n.js';
import { capitaliseWords } from '../text.js';

const { useParams } = ReactRouterDOM;

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
  const { dungeonId } = useParams();
  const pageTitle = capitaliseWords(t.scoreTitle || '');
  const initialDungeonId = dungeonId ? String(dungeonId) : null;

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
      getValue={getValue}
      formatValue={formatValue}
      getSortValue={getSortValue}
      sortDirection="desc"
      chartConfig={chartConfig}
      showDungeonIconInTitle={false}
      initialDungeonId={initialDungeonId}
    />
  );
}
