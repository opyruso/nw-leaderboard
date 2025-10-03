import { LangContext } from '../i18n.js';
import { getDungeonIconPath, getDungeonNameForLang, parseBoolean, sortDungeons } from '../dungeons.js';
import ChartCanvas from '../components/ChartCanvas.js';
import DungeonIcon from '../components/DungeonIcon.js';
import MutationIconList from '../components/MutationIconList.js';
import RankBadge from '../components/RankBadge.js';
import RelationshipGraph from '../components/RelationshipGraph.js';
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

function RelationshipIcon() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
      <circle cx="6" cy="6" r="3" fill="currentColor" opacity="0.85" />
      <circle cx="18" cy="5" r="2.5" fill="currentColor" opacity="0.6" />
      <circle cx="19" cy="17" r="3" fill="currentColor" opacity="0.8" />
      <circle cx="7" cy="18" r="2.5" fill="currentColor" opacity="0.55" />
      <path
        d="M7.6 7.5l8.2-1.6m1.2 3.6l1.4 6.2m-9.7-1.8l7.2 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" focusable="false">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.65" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.55" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" />
      <path
        d="M12 2v10l6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <path d="M2 12h20M4.5 5.5l15 13M4.5 18.5l15-13" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
    </svg>
  );
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
  const [individualRank, setIndividualRank] = React.useState(null);
  const [individualRankLoading, setIndividualRankLoading] = React.useState(false);
  const [individualRankError, setIndividualRankError] = React.useState(false);
  const [relationshipActive, setRelationshipActive] = React.useState(false);
  const [relationshipLoading, setRelationshipLoading] = React.useState(false);
  const [relationshipError, setRelationshipError] = React.useState('');
  const [relationshipData, setRelationshipData] = React.useState(null);
  const [relationshipLoadedFor, setRelationshipLoadedFor] = React.useState(null);

  const profilePlayerId = React.useMemo(() => {
    if (!profile) {
      return '';
    }
    if (profile.playerId !== undefined && profile.playerId !== null) {
      return String(profile.playerId);
    }
    if (profile.player_id !== undefined && profile.player_id !== null) {
      return String(profile.player_id);
    }
    return '';
  }, [profile]);

  const targetPlayerId = React.useMemo(() => {
    if (profilePlayerId) {
      return profilePlayerId;
    }
    if (hasPlayerId && normalisedPlayerId) {
      return normalisedPlayerId;
    }
    return '';
  }, [hasPlayerId, normalisedPlayerId, profilePlayerId]);

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
    if (!seasonInitialised) {
      return undefined;
    }

    const trimmedTargetId = typeof targetPlayerId === 'string' ? targetPlayerId.trim() : '';
    if (!trimmedTargetId) {
      setIndividualRank(null);
      setIndividualRankLoading(false);
      setIndividualRankError(false);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    setIndividualRankLoading(true);
    setIndividualRankError(false);
    setIndividualRank(null);

    const params = new URLSearchParams();
    params.set('mode', 'global');
    if (selectedSeasonId !== null && selectedSeasonId !== undefined) {
      const normalisedSeasonId = String(selectedSeasonId).trim();
      if (normalisedSeasonId) {
        params.set('seasonId', normalisedSeasonId);
      }
    }
    const url = `${API_BASE_URL}/leaderboard/individual?${params.toString()}`;

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load individual ranking: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const entries = Array.isArray(data) ? data : [];
        const matchedIndex = entries.findIndex((entry) => {
          if (!entry) {
            return false;
          }
          if (entry.playerId !== undefined && entry.playerId !== null) {
            return String(entry.playerId) === trimmedTargetId;
          }
          if (entry.player_id !== undefined && entry.player_id !== null) {
            return String(entry.player_id) === trimmedTargetId;
          }
          return false;
        });
        if (matchedIndex >= 0) {
          const entry = entries[matchedIndex] || {};
          const rawPoints = entry?.points;
          const numericPoints = Number(rawPoints);
          setIndividualRank({
            position: matchedIndex + 1,
            points: Number.isFinite(numericPoints) ? numericPoints : null,
          });
        } else {
          setIndividualRank(null);
        }
        setIndividualRankLoading(false);
      })
      .catch((rankError) => {
        if (!active || rankError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load individual ranking for player', rankError);
        setIndividualRankError(true);
        setIndividualRankLoading(false);
        setIndividualRank(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [seasonInitialised, selectedSeasonId, targetPlayerId]);

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
      highlighted: parseBoolean(
        entry?.highlighted ??
          entry?.is_highlighted ??
          entry?.isHighlighted ??
          entry?.featured ??
          entry?.isFeatured,
      ),
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

  const hasRadarCharts = React.useMemo(
    () => Boolean(scoreChartData || timeChartData),
    [scoreChartData, timeChartData],
  );

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
  const playerMainId = playerNameInfo.mainPlayerId || null;
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

  const hasIndividualRankTarget = React.useMemo(() => {
    if (typeof targetPlayerId !== 'string') {
      return false;
    }
    return targetPlayerId.trim().length > 0;
  }, [targetPlayerId]);

  React.useEffect(() => {
    setRelationshipActive(false);
    setRelationshipData(null);
    setRelationshipError('');
    setRelationshipLoading(false);
    setRelationshipLoadedFor(null);
  }, [targetPlayerId]);

  React.useEffect(() => {
    if (!hasRadarCharts) {
      setRelationshipActive(false);
    }
  }, [hasRadarCharts]);

  React.useEffect(() => {
    if (!relationshipActive || !targetPlayerId) {
      return undefined;
    }
    if (relationshipLoadedFor === targetPlayerId && relationshipData) {
      setRelationshipLoading(false);
      setRelationshipError('');
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;
    setRelationshipLoading(true);
    setRelationshipError('');
    fetch(`${API_BASE_URL}/player/${encodeURIComponent(targetPlayerId)}/relationships`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .catch(() => null)
            .then((body) => {
              const message =
                body && typeof body.message === 'string'
                  ? body.message
                  : t.playerRelationshipGraphError;
              throw new Error(message || `Failed to load relationships: ${response.status}`);
            });
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setRelationshipData(data);
        setRelationshipLoadedFor(targetPlayerId);
      })
      .catch((errorInstance) => {
        if (cancelled || errorInstance?.name === 'AbortError') {
          return;
        }
        console.error('Unable to load relationship graph', errorInstance);
        const fallback = t.playerRelationshipGraphError || 'Unable to load relationships.';
        setRelationshipError(errorInstance?.message || fallback);
      })
      .finally(() => {
        if (!cancelled) {
          setRelationshipLoading(false);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    relationshipActive,
    relationshipData,
    relationshipLoadedFor,
    targetPlayerId,
    t,
  ]);

  const alternatePlayers = React.useMemo(() => {
    if (!profile) {
      return [];
    }
    const sourceList = Array.isArray(profile.alternatePlayers)
      ? profile.alternatePlayers
      : Array.isArray(profile.alternate_players)
      ? profile.alternate_players
      : [];
    if (sourceList.length === 0) {
      return [];
    }
    const seenIds = new Set();
    const results = [];
    sourceList.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const link = formatPlayerLinkProps(entry);
      let id = link.id;
      if (!id && entry.playerId !== undefined && entry.playerId !== null) {
        id = String(entry.playerId);
      }
      if (!id && entry.player_id !== undefined && entry.player_id !== null) {
        id = String(entry.player_id);
      }
      if (!id) {
        return;
      }
      const normalisedId = String(id).trim();
      if (!normalisedId || seenIds.has(normalisedId)) {
        return;
      }
      const name = typeof link.displayName === 'string' ? link.displayName.trim() : '';
      if (!name) {
        return;
      }
      seenIds.add(normalisedId);
      results.push({
        id: normalisedId,
        name,
        tooltip: typeof link.tooltip === 'string' && link.tooltip.trim() ? link.tooltip : undefined,
      });
    });
    return results;
  }, [profile]);

  const mainPlayerLink = React.useMemo(() => {
    const rawId =
      profile && profile.mainPlayerId !== undefined && profile.mainPlayerId !== null
        ? profile.mainPlayerId
        : profile && profile.main_player_id !== undefined && profile.main_player_id !== null
        ? profile.main_player_id
        : playerMainId;
    const rawName =
      profile && typeof profile.mainPlayerName === 'string'
        ? profile.mainPlayerName
        : profile && typeof profile.main_player_name === 'string'
        ? profile.main_player_name
        : playerMainName;
    const id =
      rawId === undefined || rawId === null ? '' : String(rawId).trim();
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!id || !name) {
      return null;
    }
    return { id, name };
  }, [playerMainId, playerMainName, profile]);

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

  const handleRelationshipToggle = React.useCallback(() => {
    setRelationshipActive((previous) => {
      const next = !previous;
      if (!next) {
        setRelationshipError('');
        setRelationshipLoading(false);
      }
      return next;
    });
  }, []);

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

  const adaptabilityIndex = React.useMemo(() => {
    if (!profile) {
      return null;
    }
    const rawValue =
      profile.adaptabilityIndex !== undefined && profile.adaptabilityIndex !== null
        ? profile.adaptabilityIndex
        : profile.adaptability_index !== undefined && profile.adaptability_index !== null
        ? profile.adaptability_index
        : null;
    if (rawValue === null) {
      return null;
    }
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }, [profile]);

  const adaptabilityLabel = React.useMemo(() => {
    const label = t.playerAdaptabilityLabel;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Indice d’adaptabilité';
  }, [t]);

  const adaptabilityAriaLabel = React.useMemo(() => {
    if (adaptabilityIndex === null) {
      return '';
    }
    const aria = t.playerAdaptabilityAria;
    if (typeof aria === 'function') {
      return aria(adaptabilityIndex);
    }
    if (typeof aria === 'string' && aria.trim().length > 0) {
      return aria.replace('{value}', String(adaptabilityIndex));
    }
    return `${adaptabilityLabel}: ${adaptabilityIndex}%`;
  }, [adaptabilityIndex, adaptabilityLabel, t]);

  const individualRankLabel = React.useMemo(() => {
    const label = t.playerIndividualRankLabel;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Individual ranking';
  }, [t]);

  const individualRankLoadingLabel = React.useMemo(() => {
    const label = t.playerIndividualRankLoading;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Loading…';
  }, [t]);

  const individualRankErrorLabel = React.useMemo(() => {
    const label = t.playerIndividualRankError;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Unavailable';
  }, [t]);

  const individualRankEmptyLabel = React.useMemo(() => {
    const label = t.playerIndividualRankEmpty;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Not ranked';
  }, [t]);

  const relationshipToggleLabel = React.useMemo(() => {
    const label = t.playerRelationshipToggleLabel;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Relationship';
  }, [t]);

  const relationshipToggleBackLabel = React.useMemo(() => {
    const label = t.playerRelationshipToggleBackLabel;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Show radar charts';
  }, [t]);

  const relationshipGraphTitle = React.useMemo(() => {
    const label = t.playerRelationshipGraphTitle;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Relationships graph';
  }, [t]);

  const relationshipGraphLoadingLabel = React.useMemo(() => {
    const label = t.playerRelationshipGraphLoading;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Loading relationships…';
  }, [t]);

  const relationshipGraphErrorLabel = React.useMemo(() => {
    const label = t.playerRelationshipGraphError;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Unable to load relationships.';
  }, [t]);

  const relationshipGraphEmptyLabel = React.useMemo(() => {
    const label = t.playerRelationshipGraphEmpty;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label;
    }
    return 'Not enough data to display relationships yet.';
  }, [t]);

  const relationshipEdgeLabel = React.useCallback(
    (count) => {
      if (typeof t.playerRelationshipEdgeLabel === 'function') {
        return t.playerRelationshipEdgeLabel(count);
      }
      const safeCount = Number.isFinite(count) ? Number(count) : 0;
      if (safeCount === 1) {
        return '1 shared run';
      }
      return `${safeCount} shared runs`;
    },
    [t],
  );

  const relationshipElements = React.useMemo(() => {
    if (!relationshipData) {
      return [];
    }
    const nodes = Array.isArray(relationshipData.nodes) ? relationshipData.nodes : [];
    const edges = Array.isArray(relationshipData.edges) ? relationshipData.edges : [];
    const seenNodes = new Set();
    const elements = [];

    nodes.forEach((node) => {
      if (!node || typeof node !== 'object') {
        return;
      }
      const rawId = node.id ?? node.playerId ?? node.player_id ?? null;
      if (rawId === undefined || rawId === null) {
        return;
      }
      const id = String(rawId);
      if (seenNodes.has(id)) {
        return;
      }
      seenNodes.add(id);
      const label =
        typeof node.label === 'string' && node.label.trim().length > 0 ? node.label : id;
      const color =
        typeof node.color === 'string' && node.color.trim().length > 0
          ? node.color
          : node.category === 'origin'
          ? '#1e3a8a'
          : node.category === 'alternate'
          ? '#60a5fa'
          : '#94a3b8';
      elements.push({
        group: 'nodes',
        data: {
          id,
          label,
          color,
        },
      });
    });

    edges.forEach((edge) => {
      if (!edge || typeof edge !== 'object') {
        return;
      }
      const rawSource = edge.source ?? edge.from ?? null;
      const rawTarget = edge.target ?? edge.to ?? null;
      if (rawSource === undefined || rawSource === null || rawTarget === undefined || rawTarget === null) {
        return;
      }
      const source = String(rawSource);
      const target = String(rawTarget);
      if (!seenNodes.has(source)) {
        seenNodes.add(source);
        elements.push({
          group: 'nodes',
          data: { id: source, label: source, color: '#94a3b8' },
        });
      }
      if (!seenNodes.has(target)) {
        seenNodes.add(target);
        elements.push({
          group: 'nodes',
          data: { id: target, label: target, color: '#94a3b8' },
        });
      }
      const rawId = edge.id ?? `${source}-${target}`;
      const id = String(rawId);
      const countValue = Number(edge.sharedRuns ?? edge.count ?? 0);
      const count = Number.isFinite(countValue) && countValue > 0 ? countValue : 0;
      const color =
        typeof edge.color === 'string' && edge.color.trim().length > 0
          ? edge.color
          : edge.category === 'teammate-strong'
          ? '#22c55e'
          : edge.category === 'alternate'
          ? '#f87171'
          : '#94a3b8';
      const rawWidth = Number(edge.width);
      const width = Number.isFinite(rawWidth) && rawWidth > 0
        ? rawWidth
        : edge.category === 'alternate'
        ? 2.5
        : edge.category === 'teammate-strong'
        ? 3
        : edge.category === 'teammate-regular'
        ? 2
        : 1.5;
      const lineStyle =
        typeof edge.lineStyle === 'string' && edge.lineStyle.trim().length > 0
          ? edge.lineStyle
          : edge.category === 'alternate'
          ? 'dotted'
          : 'solid';
      elements.push({
        group: 'edges',
        data: {
          id,
          source,
          target,
          color,
          lineStyle,
          width,
          label: relationshipEdgeLabel(count),
        },
      });
    });

    return elements;
  }, [relationshipData, relationshipEdgeLabel]);

  const relationshipHasGraph = React.useMemo(() => {
    if (!relationshipData) {
      return false;
    }
    const edges = Array.isArray(relationshipData.edges) ? relationshipData.edges : [];
    return edges.length > 0;
  }, [relationshipData]);

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
            <div className="player-profile-title-row">
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
              {adaptabilityIndex !== null || hasIndividualRankTarget || hasRadarCharts ? (
                <div className="player-profile-metrics">
                  {hasRadarCharts ? (
                    <button
                      type="button"
                      className={
                        relationshipActive
                          ? 'player-relationship-toggle active'
                          : 'player-relationship-toggle'
                      }
                      onClick={handleRelationshipToggle}
                      aria-pressed={relationshipActive}
                      title={
                        relationshipActive ? relationshipToggleBackLabel : relationshipToggleLabel
                      }
                    >
                      <span className="player-relationship-toggle-icon" aria-hidden="true">
                        {relationshipActive ? <RadarIcon /> : <RelationshipIcon />}
                      </span>
                      <span className="player-relationship-toggle-text">
                        {relationshipActive ? relationshipToggleBackLabel : relationshipToggleLabel}
                      </span>
                    </button>
                  ) : null}
                  {adaptabilityIndex !== null ? (
                    <div
                      className="player-adaptability"
                      role="group"
                      aria-label={adaptabilityAriaLabel || undefined}
                      title={adaptabilityAriaLabel || undefined}
                    >
                      <span className="player-adaptability-label">{adaptabilityLabel}</span>
                      <div className="player-adaptability-gauge" aria-hidden="true">
                        <div
                          className="player-adaptability-gauge-mask"
                          style={{
                            height: `${Math.max(0, Math.min(100, 100 - adaptabilityIndex))}%`,
                          }}
                        />
                      </div>
                      <span className="player-adaptability-value">{adaptabilityIndex}%</span>
                    </div>
                  ) : null}
                  {hasIndividualRankTarget ? (
                    <div className="player-individual-ranking">
                      <span className="player-individual-ranking-label">{individualRankLabel}</span>
                      <div className="player-individual-ranking-value">
                        {individualRankLoading ? (
                          <span className="player-individual-ranking-loading">
                            {individualRankLoadingLabel}
                          </span>
                        ) : individualRankError ? (
                          <span className="player-individual-ranking-error">
                            {individualRankErrorLabel}
                          </span>
                        ) : individualRank ? (
                          renderRankIndicator(individualRank.position, individualRankLabel)
                        ) : (
                          <span className="player-individual-ranking-empty">
                            {individualRankEmptyLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {playerIsAlt && mainPlayerLink ? (
              <p className="player-profile-related player-profile-main-account">
                <span className="player-profile-related-label">
                  {t.playerMainAccountLabel || 'Main account:'}
                </span>{' '}
                <Link
                  to={`/player/${encodeURIComponent(mainPlayerLink.id)}`}
                  className="player-profile-related-link"
                >
                  {mainPlayerLink.name}
                </Link>
              </p>
            ) : null}
            {!playerIsAlt && alternatePlayers.length > 0 ? (
              <p className="player-profile-related player-profile-alternate-list">
                <span className="player-profile-related-label">
                  {t.playerAlternateListLabel || 'Alternate characters:'}
                </span>{' '}
                {alternatePlayers.map((alt, index) => (
                  <React.Fragment key={alt.id || `${alt.name}-${index}`}>
                    {index > 0 ? (
                      <span className="player-profile-related-separator">, </span>
                    ) : null}
                    <Link
                      to={`/player/${encodeURIComponent(alt.id)}`}
                      className="player-profile-related-link"
                      title={alt.tooltip || undefined}
                    >
                      {alt.name}
                    </Link>
                  </React.Fragment>
                ))}
              </p>
            ) : null}
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
            {relationshipActive || hasRadarCharts ? (
              <div
                className={
                  relationshipActive
                    ? 'player-chart-grid player-chart-grid--single'
                    : 'player-chart-grid'
                }
              >
                {relationshipActive ? (
                  <section className="player-chart-card player-relationship-card">
                    <h2 className="player-chart-title">{relationshipGraphTitle}</h2>
                    <div className="player-chart-body player-relationship-body">
                      {relationshipLoading ? (
                        <p className="player-relationship-status">{relationshipGraphLoadingLabel}</p>
                      ) : relationshipError ? (
                        <p className="player-relationship-status error">
                          {relationshipError || relationshipGraphErrorLabel}
                        </p>
                      ) : relationshipHasGraph ? (
                        <RelationshipGraph elements={relationshipElements} />
                      ) : (
                        <p className="player-relationship-status">{relationshipGraphEmptyLabel}</p>
                      )}
                    </div>
                  </section>
                ) : (
                  <>
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
                  </>
                )}
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
                  <li
                    key={dungeon.id}
                    className={
                      dungeon.highlighted
                        ? 'player-dungeon-card highlighted-glow'
                        : 'player-dungeon-card'
                    }
                  >
                    <h2 className="player-dungeon-name title-with-icon">
                      <DungeonIcon dungeonId={dungeon.id} />
                      <span>{name}</span>
                    </h2>
                    <dl
                      className={
                        dungeon.highlighted
                          ? 'player-dungeon-stats player-dungeon-stats--highlighted'
                          : 'player-dungeon-stats'
                      }
                    >
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

