import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const MAX_FILES = 6;
const EXPECTED_WIDTH = 2560;
const EXPECTED_HEIGHT = 1440;

function toLocaleHeader(lang) {
  if (lang === 'esmx') {
    return 'es-MX';
  }
  return lang || 'en';
}

function toPositiveInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function formatTime(seconds) {
  const parsed = toPositiveInteger(seconds);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '';
  }
  const total = Math.floor(parsed);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const minutesPart = String(hours > 0 ? minutes : minutes).padStart(2, '0');
  const secondsPart = String(secs).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${minutesPart}:${secondsPart}`;
  }
  return `${minutesPart}:${secondsPart}`;
}

function createEmptyPlayer(seed = Date.now()) {
  return {
    key: `player-${seed}-${Math.random().toString(36).slice(2, 8)}`,
    player_name: '',
    id_player: null,
  };
}

function normalisePlayer(player, index, seed = Date.now()) {
  const name = typeof player?.player_name === 'string' ? player.player_name.trim() : '';
  const id = Number.isFinite(player?.id_player) ? Number(player.id_player) : null;
  return {
    key: `player-${seed}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    player_name: name,
    id_player: id,
  };
}

function normaliseRun(run, index, seed = Date.now()) {
  const week = toPositiveInteger(run?.week);
  const dungeon = toPositiveInteger(run?.dungeon);
  const score = toPositiveInteger(run?.score);
  const time = toPositiveInteger(run?.time);
  const sourcePlayers = Array.isArray(run?.players) ? run.players : [];
  const players = sourcePlayers.length
    ? sourcePlayers.map((player, playerIndex) => normalisePlayer(player, playerIndex, seed))
    : [createEmptyPlayer(seed)];
  return {
    id: `run-${seed}-${index}`,
    week: week ?? '',
    dungeon: dungeon ?? '',
    score: score ?? '',
    time: time ?? '',
    players,
  };
}

function readImageMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        file,
        name: file.name,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unable to load image'));
    };
    image.src = url;
  });
}

export default function Contribute() {
  const { t, lang } = React.useContext(LangContext);
  const fileInputRef = React.useRef(null);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [runs, setRuns] = React.useState([]);
  const [status, setStatus] = React.useState('idle');
  const [messageKey, setMessageKey] = React.useState('');
  const [messageText, setMessageText] = React.useState('');
  const [errorKey, setErrorKey] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [dungeons, setDungeons] = React.useState([]);
  const [loadingDungeons, setLoadingDungeons] = React.useState(false);
  const [dungeonError, setDungeonError] = React.useState(false);

  const resetFeedback = React.useCallback(() => {
    setMessageKey('');
    setMessageText('');
    setErrorKey('');
    setErrorText('');
  }, []);

  React.useEffect(() => {
    if (!API_BASE_URL) {
      setDungeons([]);
      setDungeonError(true);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const loadDungeons = async () => {
      setLoadingDungeons(true);
      setDungeonError(false);
      try {
        const response = await fetch(`${API_BASE_URL}/dungeons`, {
          headers: {
            'Accept-Language': toLocaleHeader(lang),
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('dungeons');
        }
        const data = await response.json();
        if (cancelled) {
          return;
        }
        const formatted = Array.isArray(data)
          ? data
              .map((item) => {
                if (!item) {
                  return null;
                }
                const identifier = item.id ?? item.identifier ?? item.value;
                if (identifier === undefined || identifier === null) {
                  return null;
                }
                const label =
                  typeof item.name === 'string' && item.name.trim()
                    ? item.name.trim()
                    : String(identifier);
                return { id: identifier, name: label };
              })
              .filter(Boolean)
          : [];
        formatted.sort((a, b) => a.name.localeCompare(b.name));
        setDungeons(formatted);
      } catch (error) {
        if (!cancelled) {
          setDungeons([]);
          setDungeonError(true);
        }
      } finally {
        if (!cancelled) {
          setLoadingDungeons(false);
        }
      }
    };
    loadDungeons();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lang]);

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    setRuns([]);
    resetFeedback();
    if (!files.length) {
      setSelectedFiles([]);
      return;
    }
    if (files.length > MAX_FILES) {
      setErrorKey('contributeTooMany');
      setSelectedFiles([]);
      return;
    }
    setStatus('validating');
    try {
      const metaList = await Promise.all(files.map((file) => readImageMeta(file)));
      const invalid = metaList.find(
        (meta) => meta.width !== EXPECTED_WIDTH || meta.height !== EXPECTED_HEIGHT,
      );
      if (invalid) {
        setSelectedFiles([]);
        setErrorKey('contributeResolutionError');
        return;
      }
      setSelectedFiles(metaList);
      setMessageKey('contributeFilesReady');
    } catch (error) {
      console.warn('Unable to inspect the selected images', error);
      setSelectedFiles([]);
      setErrorKey('contributeFileLoadError');
    } finally {
      setStatus('idle');
    }
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
    setRuns([]);
    resetFeedback();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExtract = async () => {
    resetFeedback();
    if (!selectedFiles.length) {
      setErrorKey('contributeNoFiles');
      return;
    }
    if (!API_BASE_URL) {
      setErrorText('Missing API configuration.');
      return;
    }
    setStatus('extracting');
    try {
      const formData = new FormData();
      selectedFiles.forEach((item) => {
        formData.append('images', item.file, item.name || item.file.name);
      });
      const response = await fetch(`${API_BASE_URL}/contributor/extract`, {
        method: 'POST',
        body: formData,
      });
      let data = [];
      try {
        data = await response.json();
      } catch (error) {
        data = [];
      }
      if (!response.ok) {
        const apiMessage = data && data.message ? data.message : null;
        if (apiMessage) {
          setErrorText(apiMessage);
        } else {
          setErrorKey('contributeError');
        }
        return;
      }
      const timestamp = Date.now();
      const mapped = Array.isArray(data)
        ? data.map((item, index) => normaliseRun(item, index, timestamp))
        : [];
      setRuns(mapped);
      if (mapped.length) {
        setMessageKey('contributeExtractionReady');
      } else {
        setMessageKey('contributeNoResults');
      }
    } catch (error) {
      console.warn('Unable to extract runs from the provided images', error);
      setErrorKey('contributeError');
    } finally {
      setStatus('idle');
    }
  };

  const updateRun = (index, updater) => {
    setRuns((previous) =>
      previous.map((run, currentIndex) => (currentIndex === index ? updater(run) : run)),
    );
  };

  const handleWeekChange = (index, value) => {
    updateRun(index, (run) => ({
      ...run,
      week: value === '' ? '' : toPositiveInteger(value) ?? '',
    }));
  };

  const handleDungeonChange = (index, value) => {
    updateRun(index, (run) => ({
      ...run,
      dungeon: value === '' ? '' : toPositiveInteger(value) ?? '',
    }));
  };

  const handleScoreChange = (index, value) => {
    updateRun(index, (run) => ({
      ...run,
      score: value === '' ? '' : toPositiveInteger(value) ?? '',
    }));
  };

  const handleTimeChange = (index, value) => {
    updateRun(index, (run) => ({
      ...run,
      time: value === '' ? '' : toPositiveInteger(value) ?? '',
    }));
  };

  const handlePlayerChange = (runIndex, playerIndex, value) => {
    updateRun(runIndex, (run) => ({
      ...run,
      players: run.players.map((player, currentIndex) =>
        currentIndex === playerIndex
          ? {
              ...player,
              player_name: value,
              id_player: null,
            }
          : player,
      ),
    }));
  };

  const handleAddPlayer = (runIndex) => {
    updateRun(runIndex, (run) => ({
      ...run,
      players: [...run.players, createEmptyPlayer()],
    }));
  };

  const handleRemovePlayer = (runIndex, playerIndex) => {
    updateRun(runIndex, (run) => ({
      ...run,
      players: run.players.filter((_, currentIndex) => currentIndex !== playerIndex),
    }));
  };

  const handleSubmit = async () => {
    resetFeedback();
    if (!runs.length) {
      setErrorKey('contributeNoResults');
      return;
    }
    if (!API_BASE_URL) {
      setErrorText('Missing API configuration.');
      return;
    }
    const payload = runs.map((run) => {
      const week = toPositiveInteger(run.week);
      const dungeon = toPositiveInteger(run.dungeon);
      const score = toPositiveInteger(run.score);
      const time = toPositiveInteger(run.time);
      const players = run.players
        .map((player) => ({
          player_name: typeof player.player_name === 'string' ? player.player_name.trim() : '',
          id_player: Number.isFinite(player.id_player) ? Number(player.id_player) : null,
        }))
        .filter((player) => player.player_name);
      return {
        week,
        dungeon,
        score,
        time,
        players,
      };
    });

    const invalid = payload.some((item) => {
      if (!item.week || !item.dungeon) {
        return true;
      }
      const hasValue = (item.score && item.score > 0) || (item.time && item.time > 0);
      if (!hasValue) {
        return true;
      }
      return !item.players.length;
    });
    if (invalid) {
      setErrorKey('contributeValidationError');
      return;
    }

    setStatus('submitting');
    try {
      const response = await fetch(`${API_BASE_URL}/contributor/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }
      if (!response.ok) {
        const apiMessage = data && data.message ? data.message : null;
        if (apiMessage) {
          setErrorText(apiMessage);
        } else {
          setErrorKey('contributeError');
        }
        return;
      }
      setMessageKey('contributeSuccess');
      setRuns([]);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.warn('Unable to submit the extracted runs', error);
      setErrorKey('contributeError');
    } finally {
      setStatus('idle');
    }
  };

  const resolvedError = errorText || (errorKey && t[errorKey] ? t[errorKey] : '');
  const resolvedMessage = messageText || (messageKey && t[messageKey] ? t[messageKey] : '');

  return (
    <main className="page" aria-labelledby="contribute-title">
      <h1 id="contribute-title" className="page-title">
        {t.contributeTitle}
      </h1>
      <p className="page-description">{t.contributeDescription}</p>
      <section className="form contribute-form" aria-live="polite">
        <label className="form-field">
          <span>{t.contributeUploadLabel}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={status === 'validating' || status === 'extracting'}
          />
        </label>
        <p className="form-hint">{t.contributeUploadHint}</p>
        {selectedFiles.length ? (
          <div className="contribute-files">
            <h2 className="contribute-section-title">{t.contributeImagesTitle}</h2>
            <ul className="contribute-file-list">
              {selectedFiles.map((file) => (
                <li key={file.name} className="contribute-file-item">
                  <span className="contribute-file-name">{file.name}</span>
                  <span className="contribute-file-meta">{`${file.width}×${file.height}`}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="form-actions contribute-actions">
          <button
            type="button"
            onClick={handleExtract}
            disabled={
              !selectedFiles.length || status === 'extracting' || status === 'validating'
            }
          >
            {status === 'extracting' ? t.contributeExtracting : t.contributeExtract}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleClearSelection}
            disabled={!selectedFiles.length}
          >
            {t.contributeClear}
          </button>
        </div>
      </section>

      <section className="contribute-results-container" aria-live="polite">
        {loadingDungeons ? (
          <p className="form-hint">{t.contributeDungeonsLoading}</p>
        ) : null}
        {dungeonError ? (
          <p className="form-message" role="alert">
            {t.contributeDungeonsError}
          </p>
        ) : null}
        {runs.length ? (
          <div className="form contribute-results">
            <h2 className="contribute-section-title">{t.contributeResultsTitle}</h2>
            {runs.map((run, runIndex) => {
              const label =
                typeof t.contributeRunLabel === 'function'
                  ? t.contributeRunLabel(runIndex + 1)
                  : `${t.contributeResultsTitle} ${runIndex + 1}`;
              const timePreview =
                run.time && typeof t.contributeTimePreview === 'function'
                  ? t.contributeTimePreview(formatTime(run.time))
                  : '';
              return (
                <article key={run.id} className="contribute-run">
                  <header className="contribute-run-header">
                    <h3>{label}</h3>
                  </header>
                  <div className="contribute-run-grid">
                    <label className="form-field">
                      <span>{t.contributeWeek}</span>
                      <input
                        type="number"
                        min="1"
                        value={run.week === '' ? '' : run.week}
                        onChange={(event) => handleWeekChange(runIndex, event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>{t.contributeDungeon}</span>
                      <select
                        value={run.dungeon === '' ? '' : String(run.dungeon)}
                        onChange={(event) => handleDungeonChange(runIndex, event.target.value)}
                      >
                        <option value="">{t.contributeDungeonPlaceholder}</option>
                        {dungeons.map((dungeon) => (
                          <option key={dungeon.id} value={String(dungeon.id)}>
                            {dungeon.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>{t.contributeScore}</span>
                      <input
                        type="number"
                        min="0"
                        value={run.score === '' ? '' : run.score}
                        onChange={(event) => handleScoreChange(runIndex, event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>{t.contributeTime}</span>
                      <input
                        type="number"
                        min="0"
                        value={run.time === '' ? '' : run.time}
                        onChange={(event) => handleTimeChange(runIndex, event.target.value)}
                      />
                      <small className="form-hint">
                        {t.contributeTimeHint}
                        {timePreview ? ` (${timePreview})` : ''}
                      </small>
                    </label>
                  </div>
                  <div className="contribute-players">
                    <div className="contribute-players-header">
                      <span>{t.contributePlayers}</span>
                      <p className="form-hint">{t.contributePlayersHint}</p>
                    </div>
                    <ul className="contribute-player-list">
                      {run.players.map((player, playerIndex) => (
                        <li key={player.key || playerIndex} className="contribute-player-item">
                          <input
                            type="text"
                            value={player.player_name}
                            placeholder={t.contributePlayerPlaceholder}
                            onChange={(event) =>
                              handlePlayerChange(runIndex, playerIndex, event.target.value)
                            }
                          />
                          {player.id_player ? (
                            <span className="contribute-player-id">
                              {typeof t.contributeKnownPlayer === 'function'
                                ? t.contributeKnownPlayer(player.id_player)
                                : `ID: ${player.id_player}`}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleRemovePlayer(runIndex, playerIndex)}
                          >
                            {t.contributeRemovePlayer}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="form-actions contribute-player-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleAddPlayer(runIndex)}
                      >
                        {t.contributeAddPlayer}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            <div className="form-actions contribute-submit">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? t.contributeSubmitting : t.contributeSubmit}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {resolvedError ? (
        <p className="form-message" role="alert">
          {resolvedError}
        </p>
      ) : null}
      {resolvedMessage ? (
        <p className="form-message" role="status">
          {resolvedMessage}
        </p>
      ) : null}
    </main>
  );
}
