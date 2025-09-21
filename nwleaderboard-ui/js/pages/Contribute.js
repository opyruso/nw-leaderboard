import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const MAX_FILES = 1;
const EXPECTED_WIDTH = 2560;
const EXPECTED_HEIGHT = 1440;
const PLAYER_SLOTS = 6;
const RUNS_PER_IMAGE = 5;

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
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function normaliseField(field) {
  if (!field || typeof field !== 'object') {
    return { text: '', normalized: '', number: null, id: null, crop: '' };
  }
  const text = typeof field.text === 'string' ? field.text.trim() : '';
  const normalized = typeof field.normalized === 'string' ? field.normalized.trim() : '';
  const numberCandidate = field.number;
  let number = null;
  if (typeof numberCandidate === 'number' && Number.isFinite(numberCandidate)) {
    number = numberCandidate;
  } else if (typeof numberCandidate === 'string') {
    const parsedNumber = Number.parseInt(numberCandidate, 10);
    if (Number.isFinite(parsedNumber)) {
      number = parsedNumber;
    }
  }
  const idCandidate = field.id;
  let id = null;
  if (typeof idCandidate === 'number' && Number.isFinite(idCandidate)) {
    id = idCandidate;
  } else if (typeof idCandidate === 'string') {
    const parsedId = Number.parseInt(idCandidate, 10);
    if (Number.isFinite(parsedId)) {
      id = parsedId;
    }
  }
  const crop = typeof field.crop === 'string' ? field.crop : '';
  return { text, normalized, number, id, crop };
}

function createEmptyContext() {
  return {
    week: '',
    dungeon: '',
    mode: '',
    weekField: normaliseField(null),
    dungeonField: normaliseField(null),
    modeField: normaliseField(null),
  };
}

function normaliseExtractionContext(data) {
  const weekField = normaliseField(data?.week);
  const dungeonField = normaliseField(data?.dungeon);
  const modeField = normaliseField(data?.mode);
  const weekSource = weekField.number ?? weekField.normalized ?? weekField.text;
  const dungeonSource = dungeonField.id ?? dungeonField.number ?? dungeonField.normalized ?? dungeonField.text;
  const week = toPositiveInteger(weekSource) ?? '';
  const dungeon = toPositiveInteger(dungeonSource) ?? '';
  const mode = (modeField.normalized || modeField.text || '').toUpperCase();
  return {
    week,
    dungeon,
    mode,
    weekField,
    dungeonField,
    modeField,
  };
}

function sameName(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function createPlayerSlot(field, runIndex, slotIndex, seed) {
  const normalizedField = normaliseField(field);
  const baseValue = normalizedField.normalized || normalizedField.text;
  const initialId = Number.isFinite(normalizedField.id) ? Number(normalizedField.id) : null;
  return {
    key: `player-${seed}-${runIndex}-${slotIndex}-${Math.random().toString(36).slice(2, 8)}`,
    slotIndex,
    value: baseValue,
    rawText: normalizedField.text,
    normalized: normalizedField.normalized,
    originalNormalized: normalizedField.normalized,
    initialId,
    playerId: initialId,
    crop: normalizedField.crop,
  };
}

function buildRunsFromExtraction(data, context, seed = Date.now()) {
  const runsSource = Array.isArray(data?.runs) ? data.runs : [];
  const runs = [];
  for (let index = 0; index < RUNS_PER_IMAGE; index += 1) {
    const runSource = runsSource[index] || {};
    const playersSource = Array.isArray(runSource.players) ? runSource.players : [];
    const playerSlots = Array.from({ length: PLAYER_SLOTS }, (_, slotIndex) =>
      createPlayerSlot(playersSource[slotIndex], index, slotIndex, seed),
    );
    const score = Number.isFinite(runSource?.score) ? Number(runSource.score) : null;
    const time = Number.isFinite(runSource?.time) ? Number(runSource.time) : null;
    const modeValue = typeof runSource?.mode === 'string' ? runSource.mode.toUpperCase() : '';
    runs.push({
      id: `run-${seed}-${index}`,
      index,
      week: context.week ?? '',
      dungeon: context.dungeon ?? '',
      score: score ?? '',
      time: time ?? '',
      mode: modeValue || context.mode || '',
      valueField: normaliseField(runSource.value),
      playerSlots,
    });
  }
  return runs;
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

function hasRunContent(run) {
  if (!run) {
    return false;
  }
  const hasScore = toPositiveInteger(run.score) !== null;
  const hasTime = toPositiveInteger(run.time) !== null;
  const hasPlayers = run.playerSlots.some((slot) => typeof slot.value === 'string' && slot.value.trim());
  const hasValue = (run.valueField?.text && run.valueField.text.trim()) || (run.valueField?.normalized && run.valueField.normalized.trim());
  return Boolean(hasScore || hasTime || hasPlayers || hasValue);
}

export default function Contribute() {
  const { t, lang } = React.useContext(LangContext);
  const fileInputRef = React.useRef(null);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [runs, setRuns] = React.useState([]);
  const [contextFields, setContextFields] = React.useState(() => createEmptyContext());
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
    setContextFields(createEmptyContext());
    resetFeedback();
    if (!files.length) {
      setSelectedFile(null);
      return;
    }
    if (files.length > MAX_FILES) {
      setErrorKey('contributeTooMany');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    const [file] = files;
    setStatus('validating');
    try {
      const meta = await readImageMeta(file);
      if (meta.width !== EXPECTED_WIDTH || meta.height !== EXPECTED_HEIGHT) {
        setSelectedFile(null);
        setErrorKey('contributeResolutionError');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      setSelectedFile(meta);
      setMessageKey('contributeFileReady');
    } catch (error) {
      console.warn('Unable to inspect the selected images', error);
      setSelectedFile(null);
      setErrorKey('contributeFileLoadError');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setStatus('idle');
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setRuns([]);
    setContextFields(createEmptyContext());
    resetFeedback();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateRun = (index, updater) => {
    setRuns((previous) => previous.map((run, currentIndex) => (currentIndex === index ? updater(run) : run)));
  };

  const handleExtract = async () => {
    resetFeedback();
    if (!selectedFile) {
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
      formData.append('image', selectedFile.file, selectedFile.name || selectedFile.file.name);
      const response = await fetch(`${API_BASE_URL}/contributor/extract`, {
        method: 'POST',
        body: formData,
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
        setRuns([]);
        setContextFields(createEmptyContext());
        return;
      }
      const timestamp = Date.now();
      const context = normaliseExtractionContext(data || {});
      const mappedRuns = buildRunsFromExtraction(data || {}, context, timestamp);
      setContextFields(context);
      setRuns(mappedRuns);
      if (mappedRuns.some((run) => hasRunContent(run))) {
        setMessageKey('contributeExtractionReady');
      } else {
        setMessageKey('contributeNoResults');
      }
    } catch (error) {
      console.warn('Unable to extract runs from the provided image', error);
      setErrorKey('contributeError');
    } finally {
      setStatus('idle');
    }
  };

  const handleContextWeekChange = (value) => {
    const resolved = value === '' ? '' : toPositiveInteger(value) ?? '';
    setContextFields((previous) => ({ ...previous, week: resolved }));
    setRuns((previous) => previous.map((run) => ({ ...run, week: resolved })));
  };

  const handleContextDungeonChange = (value) => {
    const resolved = value === '' ? '' : toPositiveInteger(value) ?? '';
    setContextFields((previous) => ({ ...previous, dungeon: resolved }));
    setRuns((previous) => previous.map((run) => ({ ...run, dungeon: resolved })));
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
      playerSlots: run.playerSlots.map((slot, currentIndex) =>
        currentIndex === playerIndex
          ? {
              ...slot,
              value,
              playerId: sameName(slot.originalNormalized || '', value || '') ? slot.initialId : null,
            }
          : slot,
      ),
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
      const seen = new Set();
      const players = run.playerSlots
        .map((slot) => {
          const name = typeof slot.value === 'string' ? slot.value.trim() : '';
          if (!name) {
            return null;
          }
          const key = name.toLowerCase();
          if (seen.has(key)) {
            return null;
          }
          seen.add(key);
          const id = sameName(slot.originalNormalized || '', name) ? slot.initialId : null;
          return {
            player_name: name,
            id_player: Number.isFinite(id) ? id : null,
          };
        })
        .filter(Boolean);
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
      setSelectedFile(null);
      setContextFields(createEmptyContext());
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
            onChange={handleFileChange}
            disabled={status === 'validating' || status === 'extracting'}
          />
        </label>
        <p className="form-hint">{t.contributeUploadHint}</p>
        {selectedFile ? (
          <div className="contribute-files">
            <h2 className="contribute-section-title">{t.contributeImagesTitle}</h2>
            <ul className="contribute-file-list">
              <li className="contribute-file-item">
                <span className="contribute-file-name">{selectedFile.name}</span>
                <span className="contribute-file-meta">{`${selectedFile.width}×${selectedFile.height}`}</span>
              </li>
            </ul>
          </div>
        ) : null}
        <div className="form-actions contribute-actions">
          <button
            type="button"
            onClick={handleExtract}
            disabled={!selectedFile || status === 'extracting' || status === 'validating'}
          >
            {status === 'extracting' ? t.contributeExtracting : t.contributeExtract}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleClearSelection}
            disabled={!selectedFile}
          >
            {t.contributeClear}
          </button>
        </div>
      </section>

      {(contextFields.weekField.crop || contextFields.dungeonField.crop || contextFields.modeField.crop || runs.length) ? (
        <section className="form contribute-context" aria-live="polite">
          <h2 className="contribute-section-title">{t.contributeContextTitle}</h2>
          <div className="contribute-context-grid">
            <div className="contribute-context-item">
              <span className="contribute-context-label">{t.contributeWeek}</span>
              {contextFields.weekField.crop ? (
                <img
                  className="contribute-crop-image"
                  src={contextFields.weekField.crop}
                  alt={t.contributeWeek}
                />
              ) : null}
              <p className="contribute-context-ocr">
                {contextFields.weekField.text
                  ? t.contributeDetectedText(contextFields.weekField.text)
                  : t.contributeDetectedEmpty}
              </p>
              <input
                type="number"
                min="1"
                value={contextFields.week === '' ? '' : contextFields.week}
                onChange={(event) => handleContextWeekChange(event.target.value)}
              />
            </div>
            <div className="contribute-context-item">
              <span className="contribute-context-label">{t.contributeDungeon}</span>
              {contextFields.dungeonField.crop ? (
                <img
                  className="contribute-crop-image"
                  src={contextFields.dungeonField.crop}
                  alt={t.contributeDungeon}
                />
              ) : null}
              <p className="contribute-context-ocr">
                {contextFields.dungeonField.text
                  ? t.contributeDetectedText(contextFields.dungeonField.text)
                  : t.contributeDetectedEmpty}
              </p>
              <select
                value={contextFields.dungeon === '' ? '' : String(contextFields.dungeon)}
                onChange={(event) => handleContextDungeonChange(event.target.value)}
              >
                <option value="">{t.contributeDungeonPlaceholder}</option>
                {dungeons.map((dungeon) => (
                  <option key={dungeon.id} value={String(dungeon.id)}>
                    {dungeon.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="contribute-context-item">
              <span className="contribute-context-label">{t.contributeMode}</span>
              {contextFields.modeField.crop ? (
                <img
                  className="contribute-crop-image"
                  src={contextFields.modeField.crop}
                  alt={t.contributeMode}
                />
              ) : null}
              <p className="contribute-context-ocr">
                {contextFields.modeField.text
                  ? t.contributeDetectedText(contextFields.modeField.text)
                  : t.contributeDetectedEmpty}
              </p>
              <p className="contribute-context-mode">
                {contextFields.mode === 'TIME'
                  ? t.contributeModeTime
                  : contextFields.mode === 'SCORE'
                  ? t.contributeModeScore
                  : t.contributeModeUnknown}
              </p>
            </div>
          </div>
        </section>
      ) : null}

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
              const modeValue = (run.mode || contextFields.mode || '').toUpperCase();
              const modeLabel =
                modeValue === 'TIME'
                  ? t.contributeModeTime
                  : modeValue === 'SCORE'
                  ? t.contributeModeScore
                  : t.contributeModeUnknown;
              return (
                <article key={run.id} className="contribute-run">
                  <header className="contribute-run-header">
                    <h3>{label}</h3>
                    <span className="contribute-run-mode">{modeLabel}</span>
                  </header>
                  <div className="contribute-run-value">
                    {run.valueField.crop ? (
                      <img
                        className="contribute-crop-image"
                        src={run.valueField.crop}
                        alt={t.contributeValueArea}
                      />
                    ) : null}
                    <p className="contribute-context-ocr">
                      {run.valueField.text
                        ? t.contributeDetectedText(run.valueField.text)
                        : t.contributeDetectedEmpty}
                    </p>
                    <div className="contribute-run-value-inputs">
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
                  </div>
                  <div className="contribute-players">
                    <div className="contribute-players-header">
                      <span>{t.contributePlayers}</span>
                      <p className="form-hint">{t.contributePlayersHint}</p>
                    </div>
                    <ul className="contribute-player-grid">
                      {run.playerSlots.map((slot, playerIndex) => (
                        <li key={slot.key || playerIndex} className="contribute-player-slot">
                          {slot.crop ? (
                            <img
                              className="contribute-crop-image"
                              src={slot.crop}
                              alt={t.contributePlayerSlotLabel(playerIndex + 1)}
                            />
                          ) : null}
                          <p className="contribute-context-ocr">
                            {slot.rawText
                              ? t.contributeDetectedText(slot.rawText)
                              : t.contributeDetectedEmpty}
                          </p>
                          <input
                            type="text"
                            value={slot.value || ''}
                            placeholder={t.contributePlayerPlaceholder}
                            onChange={(event) =>
                              handlePlayerChange(runIndex, playerIndex, event.target.value)
                            }
                          />
                          {slot.playerId ? (
                            <span className="contribute-player-id">
                              {typeof t.contributeKnownPlayer === 'function'
                                ? t.contributeKnownPlayer(slot.playerId)
                                : `ID: ${slot.playerId}`}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
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
