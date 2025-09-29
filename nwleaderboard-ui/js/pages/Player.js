import { LangContext } from '../i18n.js';
import { getDungeonIconPath, getDungeonNameForLang, sortDungeons } from '../dungeons.js';
import ChartCanvas from '../components/ChartCanvas.js';
import DungeonIcon from '../components/DungeonIcon.js';
import MutationIconList from '../components/MutationIconList.js';
import RankBadge from '../components/RankBadge.js';
import SeasonCarousel from '../components/SeasonCarousel.js';
import { capitaliseWords } from '../text.js';
import { formatPlayerLinkProps, getPlayerNames } from '../playerNames.js';
import { extractMutationIds } from '../mutations.js';
import { translateRegion, extractRegionId, DEFAULT_REGIONS } from '../regions.js';
import {
  sortSeasons,
  findCurrentSeasonId,
  SEASON_STORAGE_PREFIX,
  loadStoredSeasonId,
  saveStoredSeasonId,
} from '../seasons.js';

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

function calculatePercentage(value, minimum, maximum) {
  if (!Number.isFinite(value) || !Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return Number.NaN;
  }
  if (maximum === minimum) {
    return 100;
  }
  const percent = ((value - minimum) / (maximum - minimum)) * 100;
  if (!Number.isFinite(percent)) {
    return Number.NaN;
  }
  return Math.max(0, Math.min(100, percent));
}

export default function Player({ canContribute = false }) {
  const { t, lang } = React.useContext(LangContext);
  const { playerId } = useParams();
  const navigate = useNavigate();
  const scoreRadarTitle = capitaliseWords(t.playerScoreRadarTitle || '');
  const timeRadarTitle = capitaliseWords(t.playerTimeRadarTitle || '');
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
  const mainLinkInputId = React.useId();
  const regionFilterId = React.useId();
  const [editingMainLink, setEditingMainLink] = React.useState(false);
  const [mainLinkName, setMainLinkName] = React.useState('');
  const [mainLinkError, setMainLinkError] = React.useState('');
  const [mainLinkLoading, setMainLinkLoading] = React.useState(false);
  const mainLinkSuggestionsListId = React.useId();
  const [mainLinkSuggestions, setMainLinkSuggestions] = React.useState([]);
  const [regionFilter, setRegionFilter] = React.useState('');
  const [seasons, setSeasons] = React.useState([]);
  const [seasonLoading, setSeasonLoading] = React.useState(false);
  const [seasonError, setSeasonError] = React.useState(false);
  const seasonStorageKey = React.useMemo(() => `${SEASON_STORAGE_PREFIX}player`, []);
  const [selectedSeasonId, setSelectedSeasonId] = React.useState(() =>
    loadStoredSeasonId(seasonStorageKey),
  );
  const [seasonInitialised, setSeasonInitialised] = React.useState(false);

  React.useEffect(() => {
    if (hasPlayerId) {
      setSearchTerm('');
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
    }
  }, [hasPlayerId]);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setSeasonLoading(true);
    setSeasonError(false);

    fetch(`${API_BASE_URL}/seasons`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load seasons: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const sorted = sortSeasons(Array.isArray(data) ? data : []);
        const availableIds = sorted.map((season) => String(season.id));
        const currentSeasonId = findCurrentSeasonId(sorted);
        const fallbackSeasonId =
          currentSeasonId && availableIds.includes(currentSeasonId)
            ? currentSeasonId
            : availableIds[0] ?? null;
        setSeasons(sorted);
        setSelectedSeasonId((previous) => {
          const normalisedPrevious =
            previous === null || previous === undefined ? previous : String(previous);
          if (normalisedPrevious === null) {
            return null;
          }
          if (seasonInitialised) {
            if (
              typeof normalisedPrevious === 'string' &&
              availableIds.includes(normalisedPrevious)
            ) {
              return normalisedPrevious;
            }
            return fallbackSeasonId ?? null;
          }
          if (typeof normalisedPrevious === 'string' && availableIds.includes(normalisedPrevious)) {
            return normalisedPrevious;
          }
          return fallbackSeasonId ?? null;
        });
      })
      .catch((seasonFetchError) => {
        if (!active || seasonFetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load seasons', seasonFetchError);
        setSeasonError(true);
        setSeasons([]);
        if (!seasonInitialised) {
          setSelectedSeasonId(null);
        }
      })
      .finally(() => {
        if (active) {
          setSeasonLoading(false);
          setSeasonInitialised(true);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  React.useEffect(() => {
    saveStoredSeasonId(seasonStorageKey, selectedSeasonId);
  }, [seasonStorageKey, selectedSeasonId]);

  React.useEffect(() => {
    setEditingMainLink(false);
    setMainLinkName('');
    setMainLinkError('');
    setMainLinkLoading(false);
    setMainLinkSuggestions([]);
  }, [normalisedPlayerId]);

  const trimmedMainLinkName = React.useMemo(() => mainLinkName.trim(), [mainLinkName]);

  const handleSeasonSelect = React.useCallback((value) => {
    setSelectedSeasonId((previous) => {
      const next = value === null || value === undefined ? null : String(value);
      if (previous === next) {
        return previous;
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!editingMainLink) {
      setMainLinkSuggestions([]);
      return undefined;
    }

    if (trimmedMainLinkName.length < 3) {
      setMainLinkSuggestions([]);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/player?q=${encodeURIComponent(trimmedMainLinkName)}&limit=8`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to search main players: ${response.status}`);
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

          const info = formatPlayerLinkProps(entry);
          if (!info || info.isAlt) {
            return;
          }

          const name = typeof info.playerName === 'string' ? info.playerName.trim() : '';
          if (!name) {
            return;
          }

          const key = name.toLowerCase();
          if (seen.has(key)) {
            return;
          }
          seen.add(key);
          mapped.push({ id: info.id || name, name });
        });

        setMainLinkSuggestions(mapped);
      })
      .catch((errorInstance) => {
        if (!active || errorInstance.name === 'AbortError') {
          return;
        }
        console.error('Unable to search main players', errorInstance);
        setMainLinkSuggestions([]);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [editingMainLink, trimmedMainLinkName]);

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

    const params = new URLSearchParams({ q: trimmed, limit: '8' });
    if (regionFilter) {
      params.set('region', regionFilter);
    }

    fetch(`${API_BASE_URL}/player?${params.toString()}`, {
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

          const info = formatPlayerLinkProps(entry);
          const id = info?.id;
          const nameCandidate =
            typeof info?.playerName === 'string' && info.playerName.trim()
              ? info.playerName.trim()
              : typeof info?.displayName === 'string'
              ? info.displayName.trim()
              : '';

          if (!id || !nameCandidate) {
            return;
          }

          const key = `id:${id}`;
          if (seen.has(key)) {
            return;
          }
          seen.add(key);
          const tooltip = info.isAlt ? info.mainName || info.tooltip || '' : info.tooltip || '';
          mapped.push({
            id,
            name: nameCandidate,
            tooltip,
            isAlt: Boolean(info.isAlt),
            mainName: info.mainName || '',
          });
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
  }, [hasPlayerId, regionFilter, searchTerm]);

  React.useEffect(() => {
    if (!hasPlayerId) {
      setProfile(null);
      setError(false);
      setLoading(false);
      return undefined;
    }
    if (!seasonInitialised) {
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setProfile(null);

    const params = new URLSearchParams();
    if (selectedSeasonId !== null && selectedSeasonId !== undefined) {
      params.set('seasonId', selectedSeasonId);
    }
    const query = params.toString();
    const url = query
      ? `${API_BASE_URL}/player/${encodeURIComponent(normalisedPlayerId)}?${query}`
      : `${API_BASE_URL}/player/${encodeURIComponent(normalisedPlayerId)}`;

    fetch(url, {
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
  }, [hasPlayerId, normalisedPlayerId, seasonInitialised, selectedSeasonId]);

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
      bestScorePosition: entry?.bestScorePosition ?? entry?.best_score_position ?? null,
      minScore: entry?.minScore ?? null,
      maxScore: entry?.maxScore ?? null,
      bestTime: entry?.bestTime ?? null,
      bestTimeWeek: entry?.bestTimeWeek ?? null,
      bestTimePosition: entry?.bestTimePosition ?? entry?.best_time_position ?? null,
      minTime: entry?.minTime ?? null,
      maxTime: entry?.maxTime ?? null,
      scoreMutations: extractMutationIds(
        entry?.bestScoreMutations,
        entry?.bestScoreMutation,
        entry?.scoreMutations,
        entry?.scoreMutation,
        entry?.best_score_mutations,
        entry?.best_score_mutation,
        entry?.score_mutations,
        entry?.score_mutation,
        {
          mutationTypeId: entry?.bestScoreMutationTypeId ?? entry?.best_score_mutation_type_id,
          mutationPromotionId:
            entry?.bestScoreMutationPromotionId ?? entry?.best_score_mutation_promotion_id,
          mutationCurseId: entry?.bestScoreMutationCurseId ?? entry?.best_score_mutation_curse_id,
        },
      ),
      timeMutations: extractMutationIds(
        entry?.bestTimeMutations,
        entry?.bestTimeMutation,
        entry?.timeMutations,
        entry?.timeMutation,
        entry?.best_time_mutations,
        entry?.best_time_mutation,
        entry?.time_mutations,
        entry?.time_mutation,
        {
          mutationTypeId: entry?.bestTimeMutationTypeId ?? entry?.best_time_mutation_type_id,
          mutationPromotionId:
            entry?.bestTimeMutationPromotionId ?? entry?.best_time_mutation_promotion_id,
          mutationCurseId: entry?.bestTimeMutationCurseId ?? entry?.best_time_mutation_curse_id,
        },
      ),
      order: index,
    }));
    return sortDungeons(base, lang);
  }, [profile, lang]);

  const scoreChartData = React.useMemo(() => {
    if (preparedDungeons.length === 0) {
      return null;
    }
    const labels = preparedDungeons.map((dungeon) => getDungeonNameForLang(dungeon, lang));
    const footerLabels = preparedDungeons.map((dungeon) => {
      const formatted = formatScoreValue(dungeon.maxScore);
      return formatted === '—' ? '' : formatted;
    });
    const percentages = preparedDungeons.map((dungeon) => {
      const value = parseScoreValue(dungeon.bestScore);
      const min = parseScoreValue(dungeon.minScore);
      const max = parseScoreValue(dungeon.maxScore);
      const percent = calculatePercentage(value, min, max);
      return Number.isFinite(percent) ? Math.round(percent * 10) / 10 : 0;
    });
    const actualValues = preparedDungeons.map((dungeon) => formatScoreValue(dungeon.bestScore));
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 100,
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
          angleLines: { color: 'rgba(148, 163, 184, 0.18)' },
          ticks: {
            backdropColor: 'transparent',
            display: false,
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
              const parsed = Number(context.parsed?.r);
              const percentLabel = Number.isFinite(parsed) ? `${Math.round(parsed)}%` : '—';
              const actual = actualValues[context.dataIndex] ?? '—';
              return `${context.label}: ${actual} (${percentLabel})`;
            },
          },
        },
        radarLabelFooter: {
          footers: footerLabels,
          color: 'rgba(148, 163, 184, 0.78)',
          font: { size: 11 },
          offset: 28,
        },
      },
    };
    const data = {
      labels,
      datasets: [
        {
          label: t.playerScoreRadarDataset,
          data: percentages,
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
    const footerLabels = preparedDungeons.map((dungeon) => {
      const formatted = formatTimeValue(dungeon.minTime);
      return formatted === '—' ? '' : formatted;
    });
    const percentages = preparedDungeons.map((dungeon) => {
      const value = toSeconds(dungeon.bestTime);
      const min = toSeconds(dungeon.minTime);
      const max = toSeconds(dungeon.maxTime);
      if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
        return 0;
      }
      if (max === min) {
        return 100;
      }
      const boundedValue = Math.min(Math.max(value, min), max);
      const percent = ((max - boundedValue) / (max - min)) * 100;
      if (!Number.isFinite(percent)) {
        return 0;
      }
      return Math.round(Math.max(0, Math.min(100, percent)) * 10) / 10;
    });
    const actualValues = preparedDungeons.map((dungeon) => formatTimeValue(dungeon.bestTime));
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 100,
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
          angleLines: { color: 'rgba(148, 163, 184, 0.18)' },
          ticks: {
            backdropColor: 'transparent',
            display: false,
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
              const parsed = Number(context.parsed?.r);
              const percentLabel = Number.isFinite(parsed) ? `${Math.round(parsed)}%` : '—';
              const actual = actualValues[context.dataIndex] ?? '—';
              return `${context.label}: ${actual} (${percentLabel})`;
            },
          },
        },
        radarLabelFooter: {
          footers: footerLabels,
          color: 'rgba(148, 163, 184, 0.78)',
          font: { size: 11 },
          offset: 28,
        },
      },
    };
    const data = {
      labels,
      datasets: [
        {
          label: t.playerTimeRadarDataset,
          data: percentages,
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

  const renderRankIndicator = React.useCallback((position, label) => {
    if (position === undefined || position === null) {
      return null;
    }
    const numeric = Number(position);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    const integer = Math.max(1, Math.floor(numeric));
    if (integer <= 9) {
      return <RankBadge position={integer} label={label} className="player-rank-badge" />;
    }
    const title = label ? `${label} #${integer}` : `#${integer}`;
    return (
      <span className="rank-badge rank-badge-text player-rank-badge" aria-label={title} title={title}>
        #{integer}
      </span>
    );
  }, []);

  const playerNameInfo = React.useMemo(() => getPlayerNames(profile), [profile]);
  const playerPrimaryName = playerNameInfo.playerName || '';
  const playerMainName = playerNameInfo.mainPlayerName || '';
  const playerIsAlt = Boolean(playerNameInfo.isAlt);

  const playerHeadingName = React.useMemo(() => {
    if (!playerPrimaryName) {
      return '';
    }
    if (playerIsAlt && playerMainName) {
      return `${playerPrimaryName} (${playerMainName})`;
    }
    return playerPrimaryName;
  }, [playerIsAlt, playerMainName, playerPrimaryName]);

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

  const handleRegionFilterChange = React.useCallback((event) => {
    setRegionFilter(event.target.value);
  }, []);

  const availableRegions = React.useMemo(() => [''].concat(DEFAULT_REGIONS), []);

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

  const handleTitleDoubleClick = React.useCallback(() => {
    if (!canContribute || !profile) {
      return;
    }
    setEditingMainLink(true);
    setMainLinkName(playerNameInfo.mainPlayerName || '');
    setMainLinkError('');
  }, [canContribute, profile, playerNameInfo.mainPlayerName]);

  const handleMainLinkChange = React.useCallback((event) => {
    setMainLinkName(event.target.value);
  }, []);

  const handleMainLinkCancel = React.useCallback(() => {
    setEditingMainLink(false);
    setMainLinkName('');
    setMainLinkError('');
    setMainLinkLoading(false);
    setMainLinkSuggestions([]);
  }, []);

  const handleMainLinkSubmit = React.useCallback(
    (event) => {
      event.preventDefault();
      if (!profile || profile.playerId === undefined || profile.playerId === null) {
        return;
      }
      const trimmed = mainLinkName.trim();
      const currentMain = playerNameInfo.mainPlayerName || '';
      if (trimmed === currentMain) {
        setEditingMainLink(false);
        return;
      }
      setMainLinkLoading(true);
      setMainLinkError('');
      const body = { main_name: trimmed.length > 0 ? trimmed : null };
      fetch(`${API_BASE_URL}/contributor/players/${encodeURIComponent(profile.playerId)}/main`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .catch(() => null)
              .then((data) => {
                const message =
                  data && typeof data.message === 'string' ? data.message : t.playerMainLinkError;
                throw new Error(message || `Failed to update main link: ${response.status}`);
              });
          }
          return response.json();
        })
        .then((data) => {
          const updated = data && data.player ? data.player : null;
          if (updated) {
            const mainNameValue =
              typeof updated.main_player_name === 'string'
                ? updated.main_player_name.trim()
                : typeof updated.mainPlayerName === 'string'
                ? updated.mainPlayerName.trim()
                : '';
            const mainIdRaw = updated.main_player_id ?? updated.mainPlayerId ?? null;
            const numericMainId =
              typeof mainIdRaw === 'number'
                ? mainIdRaw
                : typeof mainIdRaw === 'string'
                ? Number(mainIdRaw)
                : null;
            const safeMainId = Number.isFinite(numericMainId) ? numericMainId : null;
            setProfile((previous) => {
              if (!previous) {
                return previous;
              }
              return {
                ...previous,
                mainPlayerId: safeMainId,
                mainPlayerName: mainNameValue || null,
              };
            });
            setMainLinkName(mainNameValue || '');
            setEditingMainLink(false);
          }
        })
        .catch((linkErrorInstance) => {
          console.error('Unable to update main link', linkErrorInstance);
          const message =
            linkErrorInstance && linkErrorInstance.message
              ? linkErrorInstance.message
              : t.playerMainLinkError;
          setMainLinkError(message || 'Unable to link this player.');
        })
        .finally(() => {
          setMainLinkLoading(false);
        });
    },
    [profile, mainLinkName, playerNameInfo.mainPlayerName, t],
  );

  const showSearchResults =
    !searchLoading && !searchError && trimmedSearch.length >= 2 && searchResults.length > 0;
  const showSearchNoResults =
    !searchLoading && !searchError && trimmedSearch.length >= 2 && searchResults.length === 0;

  const profileRegionId = React.useMemo(() => extractRegionId(profile), [profile]);
  const profileRegionLabel = React.useMemo(
    () => (profileRegionId ? translateRegion(t, profileRegionId) : ''),
    [profileRegionId, t],
  );

  const heading = React.useMemo(() => {
    if (!hasPlayerId) {
      return capitaliseWords(t.playerBrowseTitle || '');
    }
    if (playerHeadingName) {
      return playerHeadingName;
    }
    if (loading) {
      return capitaliseWords(t.playerLoadingTitle || '');
    }
    return capitaliseWords(t.playerNotFoundTitle || '');
  }, [hasPlayerId, playerHeadingName, loading, t]);

  const headingIconId = React.useMemo(() => {
    for (const dungeon of preparedDungeons) {
      const iconPath = getDungeonIconPath(dungeon?.id);
      if (iconPath) {
        return dungeon.id;
      }
    }
    return null;
  }, [preparedDungeons]);

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
      <h1 id="player-title" className="page-title title-with-icon">
        <DungeonIcon dungeonId={headingIconId} />
        <span>{heading}</span>
      </h1>
      <section className="player-dungeon-section" aria-live="polite">
        {hasPlayerId && (playerPrimaryName || playerIdentifier) ? (
          <header
            className={`player-profile-header${editingMainLink ? ' editing-main-link' : ''}`}
            onDoubleClick={canContribute ? handleTitleDoubleClick : undefined}
            title={canContribute ? t.playerMainLinkTitle || undefined : undefined}
          >
            {profileRegionLabel ? (
              <span className="player-profile-region">[{profileRegionLabel}]</span>
            ) : null}
            <h2
              className="player-profile-name"
              title={playerIsAlt && playerMainName ? playerMainName : undefined}
            >
              {playerPrimaryName ? (
                playerIsAlt ? (
                  <span className="player-alt-name">
                    <em>{playerPrimaryName}</em>
                    <span className="player-alt-indicator" aria-hidden="true">*</span>
                  </span>
                ) : (
                  playerPrimaryName
                )
              ) : playerIdentifier ? (
                typeof t.playerIdLabel === 'function'
                  ? t.playerIdLabel(playerIdentifier)
                  : `ID #${playerIdentifier}`
              ) : (
                ''
              )}
            </h2>
            {playerPrimaryName && playerIdentifier ? (
              <p className="player-profile-identifier">
                {typeof t.playerIdLabel === 'function'
                  ? t.playerIdLabel(playerIdentifier)
                  : `ID #${playerIdentifier}`}
              </p>
            ) : null}
            {canContribute && editingMainLink ? (
              <form className="player-main-link-form" onSubmit={handleMainLinkSubmit}>
                <label className="player-main-link-label" htmlFor={mainLinkInputId}>
                  {t.playerMainLinkLabel || 'Personnage principal'}
                </label>
                <input
                  id={mainLinkInputId}
                  className="player-main-link-input"
                  type="text"
                  value={mainLinkName}
                  onChange={handleMainLinkChange}
                  disabled={mainLinkLoading}
                  placeholder={t.playerMainLinkPlaceholder || 'Nom du personnage principal'}
                  autoComplete="off"
                  spellCheck="false"
                  list={mainLinkSuggestionsListId}
                />
                <datalist id={mainLinkSuggestionsListId}>
                  {mainLinkSuggestions.map((option) => (
                    <option key={option.id} value={option.name} />
                  ))}
                </datalist>
                <div className="player-main-link-actions">
                  <button type="submit" disabled={mainLinkLoading} className="player-main-link-submit">
                    {t.playerMainLinkSubmit || 'Lier'}
                  </button>
                  <button
                    type="button"
                    onClick={handleMainLinkCancel}
                    disabled={mainLinkLoading}
                    className="player-main-link-cancel"
                  >
                    {t.playerMainLinkCancel || 'Annuler'}
                  </button>
                </div>
                {mainLinkError ? (
                  <p className="form-message error" role="alert">
                    {mainLinkError}
                  </p>
                ) : null}
                {t.playerMainLinkHint ? (
                  <p className="form-hint player-main-link-hint">{t.playerMainLinkHint}</p>
                ) : null}
              </form>
            ) : null}
          </header>
        ) : null}
        {hasPlayerId ? (
          <SeasonCarousel
            label={t.seasonSelectorLabel}
            hideLabel
            loading={!seasonInitialised || seasonLoading}
            error={seasonError}
            seasons={seasons}
            selectedSeasonId={selectedSeasonId}
            onSelect={handleSeasonSelect}
            allLabel={t.seasonSelectorAll}
            loadingLabel={t.seasonSelectorLoading}
            errorLabel={t.seasonSelectorError}
            emptyLabel={t.seasonSelectorEmpty}
            formatSeasonLabel={(season) =>
              typeof t.seasonSelectorItemLabel === 'function'
                ? t.seasonSelectorItemLabel(season.id)
                : `Season ${season.id}`
            }
            formatSeasonTitle={(season) =>
              typeof t.seasonSelectorItemTitle === 'function'
                ? t.seasonSelectorItemTitle(season.id, season.dateBegin, season.dateEnd)
                : undefined
            }
            displayRange={false}
          />
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
              <div className="player-search-filters">
                <label className="form-field player-search-region-field" htmlFor={regionFilterId}>
                  <span>{t.playerSearchRegionLabel || 'Region'}</span>
                  <select
                    id={regionFilterId}
                    value={regionFilter}
                    onChange={handleRegionFilterChange}
                  >
                    {availableRegions.map((region) => (
                      <option key={region || 'all'} value={region}>
                        {region ? translateRegion(t, region) : t.regionFilterAll || 'All'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
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
                  const nameClass = `player-search-result-name${player.isAlt ? ' player-alt-name' : ''}`;
                  const nameContent = player.isAlt ? (
                    <>
                      <em>{player.name}</em>
                      <span className="player-alt-indicator" aria-hidden="true">*</span>
                    </>
                  ) : (
                    player.name
                  );
                  return (
                    <li key={player.id} className="player-search-result">
                      <Link
                        className="player-search-result-link"
                        to={`/player/${encodeURIComponent(player.id)}`}
                        aria-label={label}
                        title={player.tooltip || undefined}
                      >
                        <span className={nameClass}>{nameContent}</span>
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
                    <h2 className="player-chart-title">{scoreRadarTitle}</h2>
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
                    <h2 className="player-chart-title">{timeRadarTitle}</h2>
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
                    <h2 className="player-dungeon-name title-with-icon">
                      <DungeonIcon dungeonId={dungeon.id} />
                      <span>{name}</span>
                    </h2>
                    <dl className="player-dungeon-stats">
                      <div className="player-dungeon-stat">
                        {renderRankIndicator(dungeon.bestScorePosition, t.playerBestScore)}
                        <dt>{t.playerBestScore}</dt>
                        <dd>
                          {hasScore ? (
                            <>
                              <span className="player-dungeon-value">{formatScoreValue(dungeon.bestScore)}</span>
                              {scoreWeekLabel ? (
                                <span className="player-dungeon-week">{scoreWeekLabel}</span>
                              ) : null}
                              <MutationIconList
                                {...(dungeon.scoreMutations ?? {})}
                                className="player-mutation-icons"
                              />
                            </>
                          ) : (
                            <span className="player-dungeon-empty">{t.playerNoScore}</span>
                          )}
                        </dd>
                      </div>
                      <div className="player-dungeon-stat">
                        {renderRankIndicator(dungeon.bestTimePosition, t.playerBestTime)}
                        <dt>{t.playerBestTime}</dt>
                        <dd>
                          {hasTime ? (
                            <>
                              <span className="player-dungeon-value">{formatTimeValue(dungeon.bestTime)}</span>
                              {timeWeekLabel ? (
                                <span className="player-dungeon-week">{timeWeekLabel}</span>
                              ) : null}
                              <MutationIconList
                                {...(dungeon.timeMutations ?? {})}
                                className="player-mutation-icons"
                              />
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

