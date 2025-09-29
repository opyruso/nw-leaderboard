import { LangContext } from '../i18n.js';
import { getDungeonNameForLang, normaliseDungeons } from '../dungeons.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const DEFAULT_RESULT_LIMIT = 100;

function formatTime(value) {
  const seconds = Number.parseInt(value, 10);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '';
  }
  const safeSeconds = Math.floor(seconds);
  const hours = Math.floor(safeSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const secs = (safeSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function normaliseRegionList(regions) {
  if (!Array.isArray(regions)) {
    return [];
  }
  return regions
    .map((region) => {
      if (!region) {
        return null;
      }
      if (typeof region === 'string') {
        return region.trim().toUpperCase();
      }
      if (typeof region.id === 'string') {
        return region.id.trim().toUpperCase();
      }
      return null;
    })
    .filter((region) => region)
    .filter((region, index, list) => list.indexOf(region) === index);
}

function normaliseSeasonOption(option) {
  if (!option || typeof option !== 'object') {
    return null;
  }
  const idValue = Number(option.id ?? option.season_id ?? option.seasonId ?? option.id_season ?? option.idSeason);
  const id = Number.isFinite(idValue) ? idValue : null;
  if (id === null) {
    return null;
  }
  const dateBegin =
    typeof option.date_begin === 'string'
      ? option.date_begin.trim()
      : typeof option.dateBegin === 'string'
        ? option.dateBegin.trim()
        : '';
  const dateEnd =
    typeof option.date_end === 'string'
      ? option.date_end.trim()
      : typeof option.dateEnd === 'string'
        ? option.dateEnd.trim()
        : '';
  let label = '';
  if (dateBegin && dateEnd) {
    label = `${dateBegin} → ${dateEnd}`;
  } else if (dateBegin) {
    label = dateBegin;
  } else if (dateEnd) {
    label = dateEnd;
  } else {
    label = String(id);
  }
  return { id, label };
}

function normaliseSeasonList(seasons) {
  if (!Array.isArray(seasons)) {
    return [];
  }
  return seasons
    .map((option) => normaliseSeasonOption(option))
    .filter((option) => option)
    .sort((left, right) => (right?.id ?? 0) - (left?.id ?? 0));
}

function normaliseRunPlayer(player) {
  if (!player || typeof player !== 'object') {
    return null;
  }
  const idValue = Number(player.id ?? player.player_id ?? player.playerId);
  const id = Number.isFinite(idValue) ? idValue : null;
  const name = typeof player.name === 'string' ? player.name.trim() : player.player_name?.trim() ?? player.playerName?.trim() ?? '';
  return { id, name };
}

function normaliseRun(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const idValue = Number(entry.id ?? entry.run_id ?? entry.runId);
  const id = Number.isFinite(idValue) ? idValue : null;
  if (id === null) {
    return null;
  }
  const mode = typeof entry.mode === 'string' ? entry.mode.trim().toLowerCase() : 'score';
  const dungeonIdValue = Number(entry.dungeon_id ?? entry.dungeonId);
  const dungeonId = Number.isFinite(dungeonIdValue) ? dungeonIdValue : null;
  const dungeonName = typeof entry.dungeon_name === 'string' ? entry.dungeon_name.trim() : '';
  const region = typeof entry.region === 'string' ? entry.region.trim().toUpperCase() : '';
  const weekValue = Number.parseInt(entry.week, 10);
  const week = Number.isFinite(weekValue) ? weekValue : null;
  const seasonValue = Number(entry.season_id ?? entry.seasonId);
  const seasonId = Number.isFinite(seasonValue) ? seasonValue : null;
  const scoreValue = Number(entry.score ?? entry.value);
  const score = Number.isFinite(scoreValue) ? scoreValue : null;
  const timeValue = Number(entry.time ?? entry.time_in_second ?? entry.timeInSecond);
  const time = Number.isFinite(timeValue) ? timeValue : null;
  const players = Array.isArray(entry.players)
    ? entry.players.map((player) => normaliseRunPlayer(player)).filter((player) => player)
    : [];
  return {
    id,
    mode: mode === 'time' ? 'time' : 'score',
    dungeonId,
    dungeonName,
    region,
    week,
    seasonId,
    score,
    time,
    players,
  };
}

function normaliseRuns(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((entry) => normaliseRun(entry)).filter((entry) => entry);
}

function normalisePlayerSuggestions(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const idValue = Number(entry.playerId ?? entry.id ?? entry.player_id);
      const id = Number.isFinite(idValue) ? idValue : null;
      const name = typeof entry.playerName === 'string' ? entry.playerName.trim() : entry.name?.trim() ?? '';
      const mainName = typeof entry.mainPlayerName === 'string' ? entry.mainPlayerName.trim() : '';
      const label = mainName && name && mainName !== name ? `${name} (${mainName})` : name;
      if (!id || !label) {
        return null;
      }
      return { id, label };
    })
    .filter((entry) => entry);
}

function getRunDungeonName(run, dungeonMap, lang) {
  if (!run) {
    return '';
  }
  if (run.dungeonId !== null && dungeonMap.has(run.dungeonId)) {
    return getDungeonNameForLang(dungeonMap.get(run.dungeonId), lang);
  }
  if (run.dungeonName) {
    return run.dungeonName;
  }
  if (run.dungeonId !== null && run.dungeonId !== undefined) {
    return String(run.dungeonId);
  }
  return '';
}

function RunEditor({ run, regions, onClose, onUpdated, onDeleted }) {
  const { t } = React.useContext(LangContext);
  const [region, setRegion] = React.useState(run.region || '');
  const [week, setWeek] = React.useState(run.week ? String(run.week) : '');
  const [value, setValue] = React.useState(() => {
    if (run.mode === 'time') {
      return run.time !== null && run.time !== undefined ? String(run.time) : '';
    }
    return run.score !== null && run.score !== undefined ? String(run.score) : '';
  });
  const [replacePlayerId, setReplacePlayerId] = React.useState('');
  const [replacementQuery, setReplacementQuery] = React.useState('');
  const [replacementOptions, setReplacementOptions] = React.useState([]);
  const [replacementPlayerId, setReplacementPlayerId] = React.useState('');
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);
  const [feedback, setFeedback] = React.useState({ type: '', message: '' });
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setRegion(run.region || '');
    setWeek(run.week ? String(run.week) : '');
    if (run.mode === 'time') {
      setValue(run.time !== null && run.time !== undefined ? String(run.time) : '');
    } else {
      setValue(run.score !== null && run.score !== undefined ? String(run.score) : '');
    }
    setReplacePlayerId('');
    setReplacementQuery('');
    setReplacementOptions([]);
    setReplacementPlayerId('');
    setFeedback({ type: '', message: '' });
    setSaving(false);
    setDeleting(false);
  }, [run.id, run.mode, run.region, run.score, run.time, run.week]);

  React.useEffect(() => {
    if (!replacementQuery || replacementQuery.trim().length < 3) {
      setReplacementOptions([]);
      setReplacementPlayerId('');
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams();
    params.set('q', replacementQuery.trim());
    params.set('limit', '10');
    const regionFilter = region || run.region || '';
    if (regionFilter) {
      params.set('region', regionFilter);
    }
    setLoadingSuggestions(true);
    fetch(`${API_BASE_URL}/player?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('failed');
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        setReplacementOptions(normalisePlayerSuggestions(data));
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setReplacementOptions([]);
      })
      .finally(() => {
        if (active) {
          setLoadingSuggestions(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [replacementQuery, region, run.region]);

  const handleSave = React.useCallback(
    (event) => {
      event.preventDefault();
      if (saving) {
        return;
      }
      const payload = {};
      const trimmedWeek = week.trim();
      if (trimmedWeek) {
        const parsedWeek = Number.parseInt(trimmedWeek, 10);
        if (!Number.isFinite(parsedWeek) || parsedWeek <= 0) {
          setFeedback({ type: 'error', message: t.contributeRunsWeekError || 'Invalid week.' });
          return;
        }
        payload.week = parsedWeek;
      }
      if (region) {
        payload.region = region;
      }
      const trimmedValue = value.trim();
      if (trimmedValue) {
        const parsedValue = Number.parseInt(trimmedValue, 10);
        if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
          setFeedback({ type: 'error', message: t.contributeRunsValueError || 'Invalid value.' });
          return;
        }
        if (run.mode === 'time') {
          payload.time = parsedValue;
        } else {
          payload.score = parsedValue;
        }
      }
      if (replacePlayerId && replacementPlayerId) {
        payload.replacement = {
          player_id: Number(replacePlayerId),
          replacement_player_id: Number(replacementPlayerId),
        };
      }
      setSaving(true);
      setFeedback({ type: '', message: '' });
      fetch(`${API_BASE_URL}/contributor/runs/${run.mode}/${run.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .catch(() => ({}))
              .then((data) => {
                const message = typeof data.message === 'string' ? data.message : null;
                throw new Error(message || 'Unable to update run.');
              });
          }
          return response.json();
        })
        .then((updated) => {
          setFeedback({ type: 'success', message: t.contributeRunsUpdateSuccess || 'Run updated.' });
          if (typeof onUpdated === 'function') {
            onUpdated(updated);
          }
        })
        .catch((error) => {
          const message = error && error.message ? error.message : t.contributeRunsUpdateError;
          setFeedback({ type: 'error', message });
        })
        .finally(() => setSaving(false));
    },
    [saving, week, region, value, replacePlayerId, replacementPlayerId, run.id, run.mode, onUpdated, t],
  );

  const handleDelete = React.useCallback(() => {
    if (deleting) {
      return;
    }
    const confirmationMessage = t.contributeRunsDeleteConfirm || 'Delete this run?';
    if (!window.confirm(confirmationMessage)) {
      return;
    }
    setDeleting(true);
    setFeedback({ type: '', message: '' });
    fetch(`${API_BASE_URL}/contributor/runs/${run.mode}/${run.id}`, {
      method: 'DELETE',
    })
      .then((response) => {
        if (!response.ok && response.status !== 204) {
          return response
            .json()
            .catch(() => ({}))
            .then((data) => {
              const message = typeof data.message === 'string' ? data.message : null;
              throw new Error(message || 'Unable to delete run.');
            });
        }
        if (typeof onDeleted === 'function') {
          onDeleted(run.id);
        }
      })
      .catch((error) => {
        const message = error && error.message ? error.message : t.contributeRunsDeleteError;
        setFeedback({ type: 'error', message });
      })
      .finally(() => setDeleting(false));
  }, [deleting, onDeleted, run.id, run.mode, t]);

  return (
    <form className="form contribute-runs-editor" onSubmit={handleSave} aria-live="polite">
      <div className="form-row">
        <label className="form-field">
          <span>{t.contributeRunsRegionLabel}</span>
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="">{t.contributeRunsRegionPlaceholder}</option>
            {regions.map((regionOption) => (
              <option key={regionOption} value={regionOption}>
                {regionOption}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>{t.contributeRunsWeekLabel}</span>
          <input value={week} onChange={(event) => setWeek(event.target.value)} type="number" min="1" />
        </label>
        <label className="form-field">
          <span>{run.mode === 'time' ? t.contributeRunsTimeLabel : t.contributeRunsScoreLabel}</span>
          <input value={value} onChange={(event) => setValue(event.target.value)} type="number" min="1" />
        </label>
      </div>
      <div className="form-row">
        <label className="form-field">
          <span>{t.contributeRunsReplacePlayerLabel}</span>
          <select value={replacePlayerId} onChange={(event) => setReplacePlayerId(event.target.value)}>
            <option value="">{t.contributeRunsReplacePlayerPlaceholder}</option>
            {run.players.map((player) => (
              <option key={player.id ?? `player-${player.name}`} value={player.id || ''}>
                {player.name || player.id}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field contribute-runs-replacement-field">
          <span>{t.contributeRunsReplacementSearchLabel}</span>
          <input
            value={replacementQuery}
            onChange={(event) => setReplacementQuery(event.target.value)}
            placeholder={t.contributeRunsReplacementPlaceholder}
            type="search"
            autoComplete="off"
          />
          {loadingSuggestions ? (
            <span className="form-hint contribute-runs-replacement-hint">{t.contributeRunsReplacementLoading}</span>
          ) : null}
          {replacementOptions.length ? (
            <select
              className="contribute-runs-replacement-select"
              value={replacementPlayerId}
              onChange={(event) => setReplacementPlayerId(event.target.value)}
            >
              <option value="">{t.contributeRunsReplacementSelectPlaceholder}</option>
              {replacementOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
        </label>
      </div>
      {feedback.message ? (
        <p className={`form-message${feedback.type === 'error' ? ' error' : ''}`}>{feedback.message}</p>
      ) : null}
      <div className="form-actions">
        <button type="button" onClick={onClose} disabled={saving || deleting}>
          {t.contributeRunsCancel}
        </button>
        <button type="submit" disabled={saving || deleting}>
          {saving ? t.contributeRunsSaving : t.contributeRunsSave}
        </button>
        <button
          type="button"
          className="danger"
          onClick={handleDelete}
          disabled={saving || deleting}
        >
          {deleting ? t.contributeRunsDeleting : t.contributeRunsDelete}
        </button>
      </div>
    </form>
  );
}

export default function ContributeRuns() {
  const { t, lang } = React.useContext(LangContext);
  const [regions, setRegions] = React.useState([]);
  const [seasons, setSeasons] = React.useState([]);
  const [dungeons, setDungeons] = React.useState([]);
  const dungeonMap = React.useMemo(() => {
    const map = new Map();
    dungeons.forEach((dungeon) => {
      if (dungeon && dungeon.id !== undefined && dungeon.id !== null) {
        map.set(dungeon.id, dungeon);
      }
    });
    return map;
  }, [dungeons]);

  const [mode, setMode] = React.useState('score');
  const [region, setRegion] = React.useState('');
  const [season, setSeason] = React.useState('');
  const [week, setWeek] = React.useState('');
  const [score, setScore] = React.useState('');
  const [time, setTime] = React.useState('');
  const [playerFilters, setPlayerFilters] = React.useState(['']);
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [expandedRunId, setExpandedRunId] = React.useState(null);

  React.useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(`${API_BASE_URL}/contributor/regions`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('failed');
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        setRegions(normaliseRegionList(data));
      })
      .catch(() => {
        if (active) {
          setRegions([]);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(`${API_BASE_URL}/contributor/seasons`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('failed');
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        setSeasons(normaliseSeasonList(data));
      })
      .catch(() => {
        if (active) {
          setSeasons([]);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch(`${API_BASE_URL}/dungeons`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('failed');
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        setDungeons(normaliseDungeons(data));
      })
      .catch(() => {
        if (active) {
          setDungeons([]);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const handlePlayerFilterChange = React.useCallback((index, value) => {
    setPlayerFilters((previous) => {
      const next = previous.slice();
      next[index] = value;
      return next;
    });
  }, []);

  const handleAddPlayerFilter = React.useCallback(() => {
    setPlayerFilters((previous) => [...previous, '']);
  }, []);

  const handleRemovePlayerFilter = React.useCallback((index) => {
    setPlayerFilters((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  }, []);

  const handleSearch = React.useCallback(
    (event) => {
      event.preventDefault();
      if (loading) {
        return;
      }
      const params = new URLSearchParams();
      params.set('type', mode);
      const trimmedRegion = region.trim();
      if (trimmedRegion) {
        params.set('region', trimmedRegion);
      }
      const trimmedSeason = season.trim();
      if (trimmedSeason) {
        params.set('season', trimmedSeason);
      }
      const trimmedWeek = week.trim();
      if (trimmedWeek) {
        params.set('week', trimmedWeek);
      }
      if (mode === 'score') {
        const trimmedScore = score.trim();
        if (trimmedScore) {
          params.set('score', trimmedScore);
        }
      } else {
        const trimmedTime = time.trim();
        if (trimmedTime) {
          params.set('time', trimmedTime);
        }
      }
      playerFilters.forEach((filter) => {
        const trimmed = filter.trim();
        if (trimmed) {
          params.append('player', trimmed);
        }
      });
      params.set('limit', String(DEFAULT_RESULT_LIMIT));
      setLoading(true);
      setError('');
      fetch(`${API_BASE_URL}/contributor/runs?${params.toString()}`)
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .catch(() => ({}))
              .then((data) => {
                const message = typeof data.message === 'string' ? data.message : null;
                throw new Error(message || 'Unable to load runs.');
              });
          }
          return response.json();
        })
        .then((data) => {
          setResults(normaliseRuns(data));
          setExpandedRunId(null);
        })
        .catch((error) => {
          const message = error && error.message ? error.message : t.contributeRunsLoadError;
          setError(message);
          setResults([]);
        })
        .finally(() => setLoading(false));
    },
    [loading, mode, region, season, week, score, time, playerFilters, t],
  );

  const handleReset = React.useCallback(() => {
    setRegion('');
    setSeason('');
    setWeek('');
    setScore('');
    setTime('');
    setPlayerFilters(['']);
  }, []);

  const handleRunUpdated = React.useCallback((updatedRun) => {
    if (!updatedRun || typeof updatedRun !== 'object') {
      return;
    }
    const normalised = normaliseRun(updatedRun);
    if (!normalised) {
      return;
    }
    setResults((previous) =>
      previous.map((run) => (run.id === normalised.id ? { ...run, ...normalised } : run)),
    );
  }, []);

  const handleRunDeleted = React.useCallback((runId) => {
    setResults((previous) => previous.filter((run) => run.id !== runId));
    setExpandedRunId(null);
  }, []);

  const renderRunValue = React.useCallback(
    (run) => {
      if (!run) {
        return '';
      }
      if (run.mode === 'time') {
        return run.time !== null && run.time !== undefined ? formatTime(run.time) : '';
      }
      return run.score !== null && run.score !== undefined ? run.score.toLocaleString() : '';
    },
    [],
  );

  return (
    <section className="contribute-runs" aria-live="polite">
      <p className="page-description">{t.contributeRunsDescription}</p>
      <form className="form contribute-runs-form" onSubmit={handleSearch}>
        <div className="form-row contribute-runs-mode-row">
          <label className="form-field contribute-runs-mode">
            <span>{t.contributeRunsModeLabel}</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="score">{t.contributeRunsModeScore}</option>
              <option value="time">{t.contributeRunsModeTime}</option>
            </select>
          </label>
          <label className="form-field">
            <span>{t.contributeRunsRegionLabel}</span>
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="">{t.contributeRunsRegionPlaceholder}</option>
              {regions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t.contributeRunsSeasonLabel}</span>
            <select value={season} onChange={(event) => setSeason(event.target.value)}>
              <option value="">{t.contributeRunsSeasonPlaceholder}</option>
              {seasons.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t.contributeRunsWeekLabel}</span>
            <input value={week} onChange={(event) => setWeek(event.target.value)} type="number" min="1" />
          </label>
          {mode === 'score' ? (
            <label className="form-field">
              <span>{t.contributeRunsScoreLabel}</span>
              <input value={score} onChange={(event) => setScore(event.target.value)} type="number" min="1" />
            </label>
          ) : (
            <label className="form-field">
              <span>{t.contributeRunsTimeLabel}</span>
              <input value={time} onChange={(event) => setTime(event.target.value)} type="number" min="1" />
            </label>
          )}
        </div>
        <fieldset className="contribute-runs-player-fieldset">
          <legend>{t.contributeRunsPlayersLabel}</legend>
          {playerFilters.map((playerFilter, index) => (
            <div key={`player-filter-${index}`} className="contribute-runs-player-row">
              <input
                type="text"
                value={playerFilter}
                onChange={(event) => handlePlayerFilterChange(index, event.target.value)}
                placeholder={t.contributeRunsPlayerPlaceholder}
              />
              {playerFilters.length > 1 ? (
                <button
                  type="button"
                  className="button-tertiary"
                  onClick={() => handleRemovePlayerFilter(index)}
                >
                  {t.contributeRunsPlayerRemove}
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="button-tertiary" onClick={handleAddPlayerFilter}>
            {t.contributeRunsPlayerAdd}
          </button>
        </fieldset>
        <div className="form-actions contribute-runs-actions">
          <button type="submit" disabled={loading}>
            {loading ? t.contributeRunsSearching : t.contributeRunsSearch}
          </button>
          <button type="button" onClick={handleReset} disabled={loading}>
            {t.contributeRunsReset}
          </button>
        </div>
      </form>
      <section className="contribute-runs-results">
        {loading ? <p className="form-hint">{t.contributeRunsLoading}</p> : null}
        {error ? (
          <p className="form-message error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error ? (
          results.length ? (
            <ul className="contribute-runs-list">
              {results.map((run) => {
                const isExpanded = expandedRunId === run.id;
                const dungeonName = getRunDungeonName(run, dungeonMap, lang);
                const valueLabel = renderRunValue(run);
                const players = run.players.map((player) => player.name || player.id).filter(Boolean).join(', ');
                return (
                  <li key={run.id} className="contribute-runs-item">
                    <button
                      type="button"
                      className="contribute-runs-summary"
                      onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                    >
                      <span className="contribute-runs-dungeon">{dungeonName}</span>
                      <span className="contribute-runs-meta">
                        {run.region ? `${run.region} • ` : ''}
                        {run.seasonId ? `${t.contributeRunsSeasonShort} ${run.seasonId} • ` : ''}
                        {run.week ? `${t.contributeRunsWeekShort} ${run.week} • ` : ''}
                        {run.mode === 'time'
                          ? `${t.contributeRunsTimeShort} ${valueLabel}`
                          : `${t.contributeRunsScoreShort} ${valueLabel}`}
                      </span>
                      <span className="contribute-runs-players">{players}</span>
                    </button>
                    {isExpanded ? (
                      <RunEditor
                        run={run}
                        regions={regions}
                        onClose={() => setExpandedRunId(null)}
                        onUpdated={handleRunUpdated}
                        onDeleted={handleRunDeleted}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="form-hint">{t.contributeRunsEmpty}</p>
          )
        ) : null}
      </section>
    </section>
  );
}
