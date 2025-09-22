import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const MAX_FILES = 12;
const EXPECTED_WIDTH = 2560;
const EXPECTED_HEIGHT = 1440;
const DEFAULT_PLAYER_SLOTS = 6;
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

function normaliseConfidenceValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, parsed));
  const rounded = Math.round(clamped * 10) / 10;
  if (!Number.isFinite(rounded)) {
    return null;
  }
  const asInteger = Math.round(rounded);
  if (Math.abs(rounded - asInteger) < 0.05) {
    return asInteger;
  }
  return rounded;
}

function normaliseField(field) {
  if (!field || typeof field !== 'object') {
    return {
      text: '',
      normalized: '',
      number: null,
      id: null,
      crop: '',
      confidence: null,
      status: '',
      alreadyExists: null,
      details: null,
      confirmed: true,
    };
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
  const status = typeof field.status === 'string' ? field.status.trim().toLowerCase() : '';
  const confidence = normaliseConfidenceValue(field.confidence);
  let alreadyExists = null;
  if (typeof field.already_exists === 'boolean') {
    alreadyExists = field.already_exists;
  } else if (typeof field.alreadyExists === 'boolean') {
    alreadyExists = field.alreadyExists;
  }
  let details = null;
  if (field.details && typeof field.details === 'object') {
    details = {};
    Object.entries(field.details).forEach(([key, value]) => {
      if (key) {
        details[key] = value;
      }
    });
    if (!Object.keys(details).length) {
      details = null;
    }
  }
  const confirmed = status === 'warning' ? false : true;
  return { text, normalized, number, id, crop, confidence, status, alreadyExists, details, confirmed };
}

function cloneField(field) {
  if (!field || typeof field !== 'object') {
    return null;
  }
  const copy = { ...field };
  if (field.details && typeof field.details === 'object') {
    copy.details = { ...field.details };
  }
  return copy;
}

function mergeContextField(currentField, candidateField) {
  const candidate = cloneField(candidateField);
  if (!candidate) {
    return currentField ? cloneField(currentField) : null;
  }
  const current = currentField ? cloneField(currentField) : null;
  if (!current) {
    return candidate;
  }
  const merged = { ...current };
  if (!merged.text && candidate.text) {
    merged.text = candidate.text;
  }
  if (!merged.normalized && candidate.normalized) {
    merged.normalized = candidate.normalized;
  }
  if ((merged.number === null || merged.number === undefined) && candidate.number !== null && candidate.number !== undefined) {
    merged.number = candidate.number;
  }
  if ((merged.id === null || merged.id === undefined) && candidate.id !== null && candidate.id !== undefined) {
    merged.id = candidate.id;
  }
  if (!merged.crop && candidate.crop) {
    merged.crop = candidate.crop;
  }
  if (
    (merged.confidence === null || merged.confidence === undefined || Number.isNaN(merged.confidence)) &&
    candidate.confidence !== null &&
    candidate.confidence !== undefined &&
    !Number.isNaN(candidate.confidence)
  ) {
    merged.confidence = candidate.confidence;
  }
  if (!merged.status && candidate.status) {
    merged.status = candidate.status;
  }
  if (merged.status !== 'success' && candidate.status === 'success') {
    merged.status = 'success';
  } else if (merged.status !== 'success' && candidate.status === 'warning') {
    merged.status = 'warning';
  }
  if (merged.alreadyExists !== true && candidate.alreadyExists === true) {
    merged.alreadyExists = true;
  } else if (
    (merged.alreadyExists === null || merged.alreadyExists === undefined) &&
    candidate.alreadyExists !== undefined &&
    candidate.alreadyExists !== null
  ) {
    merged.alreadyExists = candidate.alreadyExists;
  }
  if (candidate.details) {
    const mergedDetails = { ...(candidate.details || {}) };
    if (merged.details) {
      Object.entries(merged.details).forEach(([key, value]) => {
        if (!mergedDetails.hasOwnProperty(key) || mergedDetails[key] === null || mergedDetails[key] === undefined) {
          mergedDetails[key] = value;
        }
      });
    }
    merged.details = Object.keys(mergedDetails).length ? mergedDetails : null;
  }
  const currentConfirmed = merged.confirmed === undefined ? true : merged.confirmed;
  const candidateConfirmed = candidate.confirmed === undefined ? true : candidate.confirmed;
  merged.confirmed = Boolean(currentConfirmed && candidateConfirmed);
  return merged;
}

function pickExpectedPlayerCount(current, candidate) {
  const currentValid = Number.isFinite(current) && current > 0;
  const candidateValid = Number.isFinite(candidate) && candidate > 0;
  if (!currentValid && candidateValid) {
    return candidate;
  }
  if (currentValid && candidateValid) {
    if (current === DEFAULT_PLAYER_SLOTS && candidate !== DEFAULT_PLAYER_SLOTS) {
      return candidate;
    }
    return current;
  }
  return currentValid ? current : candidateValid ? candidate : DEFAULT_PLAYER_SLOTS;
}

function mergeContexts(current, candidate) {
  if (!candidate) {
    return current ? {
        ...current,
        weekField: mergeContextField(current.weekField, null),
        dungeonField: mergeContextField(current.dungeonField, null),
        modeField: mergeContextField(current.modeField, null),
      } : null;
  }
  if (!current) {
    return {
      week: candidate.week,
      dungeon: candidate.dungeon,
      mode: candidate.mode,
      expectedPlayerCount: candidate.expectedPlayerCount,
      weekField: mergeContextField(null, candidate.weekField),
      dungeonField: mergeContextField(null, candidate.dungeonField),
      modeField: mergeContextField(null, candidate.modeField),
    };
  }
  const expectedPlayerCount = pickExpectedPlayerCount(current.expectedPlayerCount, candidate.expectedPlayerCount);
  return {
    week: current.week || candidate.week || '',
    dungeon: current.dungeon || candidate.dungeon || '',
    mode: (current.mode || candidate.mode || '').toUpperCase(),
    expectedPlayerCount,
    weekField: mergeContextField(current.weekField, candidate.weekField),
    dungeonField: mergeContextField(current.dungeonField, candidate.dungeonField),
    modeField: mergeContextField(current.modeField, candidate.modeField),
  };
}

function createEmptyContext() {
  return {
    week: '',
    dungeon: '',
    mode: '',
    expectedPlayerCount: DEFAULT_PLAYER_SLOTS,
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
  const responsePlayerCount = toPositiveInteger(data?.expected_player_count);
  const dungeonDetailsCount = dungeonField.details && toPositiveInteger(dungeonField.details.player_count);
  const expectedPlayerCount = responsePlayerCount ?? dungeonDetailsCount ?? DEFAULT_PLAYER_SLOTS;
  return {
    week,
    dungeon,
    mode,
    expectedPlayerCount,
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

function getStatusClass(status, confirmed = false) {
  if (!status) {
    return '';
  }
  const normalized = status.toLowerCase();
  if (normalized === 'warning') {
    return confirmed ? 'status-success' : 'status-warning';
  }
  if (normalized === 'success') {
    return 'status-success';
  }
  return '';
}

function createPlayerSlot(field, runIndex, slotIndex, seed) {
  const normalizedField = normaliseField(field);
  const baseValue = normalizedField.normalized || normalizedField.text;
  const initialId = Number.isFinite(normalizedField.id) ? Number(normalizedField.id) : null;
  const details = normalizedField.details ? { ...normalizedField.details } : null;
  const status = normalizedField.status || '';
  const alreadyExists = normalizedField.alreadyExists === true;
  return {
    key: `player-${seed}-${runIndex}-${slotIndex}-${Math.random().toString(36).slice(2, 8)}`,
    slotIndex,
    value: baseValue,
    rawText: normalizedField.text,
    normalized: normalizedField.normalized,
    originalNormalized: normalizedField.normalized,
    initialId,
    playerId: initialId,
    status,
    alreadyExists,
    confirmed: normalizedField.confirmed,
    details,
    crop: normalizedField.crop,
    confidence: normalizedField.confidence,
  };
}

function buildRunsFromExtraction(data, context, seed = Date.now()) {
  const runsSource = Array.isArray(data?.runs) ? data.runs : [];
  const runs = [];
  const defaultExpected = toPositiveInteger(context?.expectedPlayerCount) ?? DEFAULT_PLAYER_SLOTS;
  for (let index = 0; index < RUNS_PER_IMAGE; index += 1) {
    const runSource = runsSource[index] || {};
    const playersSource = Array.isArray(runSource.players) ? runSource.players : [];
    const runExpected = toPositiveInteger(runSource?.expected_player_count) ?? defaultExpected;
    const playerSlots = Array.from({ length: runExpected }, (_, slotIndex) =>
      createPlayerSlot(playersSource[slotIndex], index, slotIndex, seed),
    );
    const score = Number.isFinite(runSource?.score) ? Number(runSource.score) : null;
    const time = Number.isFinite(runSource?.time) ? Number(runSource.time) : null;
    const modeValue = typeof runSource?.mode === 'string' ? runSource.mode.toUpperCase() : '';
    const valueField = normaliseField(runSource.value);
    runs.push({
      id: `run-${seed}-${index}`,
      index,
      week: context.week ?? '',
      dungeon: context.dungeon ?? '',
      score: score ?? '',
      time: time ?? '',
      mode: modeValue || context.mode || '',
      valueField,
      playerSlots,
      expectedPlayerCount: runExpected,
    });
  }
  return runs;
}

function applyExpectedPlayerCountToRun(run, expectedCount, seed = Date.now()) {
  const safeExpected = Number.isFinite(expectedCount) && expectedCount > 0 ? expectedCount : DEFAULT_PLAYER_SLOTS;
  const existingSlots = Array.isArray(run?.playerSlots) ? run.playerSlots : [];
  const trimmed = existingSlots.slice(0, safeExpected).map((slot, slotIndex) => ({
    ...slot,
    slotIndex,
  }));
  if (trimmed.length === safeExpected) {
    return { ...run, expectedPlayerCount: safeExpected, playerSlots: trimmed };
  }
  const additions = Array.from({ length: safeExpected - trimmed.length }, (_, offset) =>
    createPlayerSlot(null, run?.index ?? 0, trimmed.length + offset, seed),
  );
  return { ...run, expectedPlayerCount: safeExpected, playerSlots: trimmed.concat(additions) };
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
  const [selectedFiles, setSelectedFiles] = React.useState(() => []);
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

  const getConfidenceLabel = React.useCallback(
    (confidence) => {
      const normalized = normaliseConfidenceValue(confidence);
      if (!Number.isFinite(normalized)) {
        return '';
      }
      const formatted = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
      if (typeof t.contributeConfidence === 'function') {
        return t.contributeConfidence(formatted);
      }
      if (typeof t.contributeConfidence === 'string') {
        return `${t.contributeConfidence}: ${formatted}%`;
      }
      return `Confidence: ${formatted}%`;
    },
    [t],
  );

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
                const playerCount = Number.isFinite(item.player_count) ? Number(item.player_count) : null;
                return { id: identifier, name: label, playerCount };
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
      setSelectedFiles([]);
      return;
    }
    if (files.length > MAX_FILES) {
      setErrorKey('contributeTooMany');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    setStatus('validating');
    try {
      const metadata = await Promise.all(files.map((file) => readImageMeta(file)));
      const invalid = metadata.find((meta) => meta.width !== EXPECTED_WIDTH || meta.height !== EXPECTED_HEIGHT);
      if (invalid) {
        setSelectedFiles([]);
        setErrorKey('contributeResolutionError');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      setSelectedFiles(metadata);
      if (metadata.length === 1) {
        setMessageText('');
        setMessageKey('contributeFileReady');
      } else {
        setMessageKey('');
        const message =
          typeof t.contributeFilesReady === 'function'
            ? t.contributeFilesReady(metadata.length)
            : `${metadata.length} ${t.contributeFilesReady || 'images ready for extraction.'}`;
        setMessageText(message);
      }
    } catch (error) {
      console.warn('Unable to inspect the selected images', error);
      setSelectedFiles([]);
      setErrorKey('contributeFileLoadError');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setStatus('idle');
    }
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
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
      setRuns([]);
      setContextFields(createEmptyContext());
      const aggregatedRuns = [];
      let mergedContext = null;
      const timestampBase = Date.now();

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const meta = selectedFiles[index];
        if (!meta || !meta.file) {
          continue;
        }
        const formData = new FormData();
        const fileName = meta.name || meta.file.name || `image-${index + 1}`;
        formData.append('image', meta.file, fileName);
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

        const context = normaliseExtractionContext(data || {});
        mergedContext = mergeContexts(mergedContext, context) || context;
        const runsForImage = buildRunsFromExtraction(data || {}, context, `${timestampBase}-${index}`);
        aggregatedRuns.push(...runsForImage);
      }

      const finalContext = mergedContext || createEmptyContext();
      setContextFields(finalContext);
      const runsWithContext = aggregatedRuns.map((run) => ({
        ...run,
        week: finalContext.week ?? run.week ?? '',
        dungeon: finalContext.dungeon ?? run.dungeon ?? '',
        mode: run.mode || finalContext.mode || '',
        expectedPlayerCount:
          Number.isFinite(run.expectedPlayerCount) && run.expectedPlayerCount > 0
            ? run.expectedPlayerCount
            : finalContext.expectedPlayerCount || DEFAULT_PLAYER_SLOTS,
      }));
      setRuns(runsWithContext);
      if (runsWithContext.some((run) => hasRunContent(run))) {
        setMessageKey('contributeExtractionReady');
        setMessageText('');
      } else {
        setMessageKey('contributeNoResults');
        setMessageText('');
      }
    } catch (error) {
      console.warn('Unable to extract runs from the provided images', error);
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
    const selectedDungeon = dungeons.find((item) => String(item.id) === String(resolved));
    const expectedFromSelection = Number.isFinite(selectedDungeon?.playerCount)
      ? Number(selectedDungeon.playerCount)
      : DEFAULT_PLAYER_SLOTS;
    const timestamp = Date.now();
    setContextFields((previous) => {
      const currentDetails = previous.dungeonField.details ? { ...previous.dungeonField.details } : {};
      if (expectedFromSelection) {
        currentDetails.player_count = expectedFromSelection;
      }
      return {
        ...previous,
        dungeon: resolved,
        expectedPlayerCount: expectedFromSelection,
        dungeonField: {
          ...previous.dungeonField,
          status: resolved ? 'success' : previous.dungeonField.status,
          confirmed: true,
          details: Object.keys(currentDetails).length ? currentDetails : null,
        },
      };
    });
    setRuns((previous) =>
      previous.map((run) =>
        applyExpectedPlayerCountToRun(
          {
            ...run,
            dungeon: resolved,
          },
          expectedFromSelection,
          timestamp,
        ),
      ),
    );
  };

  const handleScoreChange = (index, value) => {
    updateRun(index, (run) => ({
      ...run,
      score: value === '' ? '' : toPositiveInteger(value) ?? '',
      valueField: run.valueField
        ? { ...run.valueField, confirmed: false, status: 'warning' }
        : run.valueField,
    }));
  };

  const handleTimeChange = (index, value) => {
    updateRun(index, (run) => ({
      ...run,
      time: value === '' ? '' : toPositiveInteger(value) ?? '',
      valueField: run.valueField
        ? { ...run.valueField, confirmed: false, status: 'warning' }
        : run.valueField,
    }));
  };

  const handlePlayerChange = (runIndex, playerIndex, value) => {
    updateRun(runIndex, (run) => ({
      ...run,
      playerSlots: run.playerSlots.map((slot, currentIndex) => {
        if (currentIndex !== playerIndex) {
          return slot;
        }
        const trimmed = typeof value === 'string' ? value.trim() : '';
        const detailsName = slot.details && typeof slot.details.name === 'string' ? slot.details.name : '';
        const detailsId = slot.details && Number.isFinite(Number(slot.details.id)) ? Number(slot.details.id) : null;
        const matchesDetails = Boolean(detailsName) && sameName(detailsName, trimmed);
        const suggestion =
          slot.details && typeof slot.details.suggestion === 'object' ? slot.details.suggestion : null;
        const suggestionName =
          suggestion && typeof suggestion.name === 'string' ? suggestion.name : '';
        const suggestionId =
          suggestion && Number.isFinite(Number(suggestion.id)) ? Number(suggestion.id) : null;
        const matchesSuggestion = Boolean(suggestionName) && sameName(suggestionName, trimmed);
        const matchesOriginal = sameName(slot.originalNormalized || '', trimmed);
        const playerId = matchesDetails
          ? (Number.isFinite(detailsId) ? detailsId : null)
          : matchesSuggestion
          ? (Number.isFinite(suggestionId) ? suggestionId : null)
          : matchesOriginal && Number.isFinite(slot.initialId)
          ? Number(slot.initialId)
          : null;
        const status = trimmed ? (matchesDetails || matchesSuggestion ? 'success' : 'warning') : '';
        const alreadyExists = trimmed ? matchesDetails || matchesSuggestion : null;
        const confirmed = trimmed ? matchesDetails || matchesSuggestion : true;
        return {
          ...slot,
          value,
          normalized: trimmed,
          playerId,
          status,
          alreadyExists,
          confirmed,
        };
      }),
    }));
  };

  const handlePlayerApplySuggestion = (runIndex, playerIndex) => {
    const run = runs?.[runIndex];
    if (!run) {
      return;
    }
    const slot = Array.isArray(run.playerSlots) ? run.playerSlots[playerIndex] : null;
    if (!slot) {
      return;
    }
    const suggestion =
      slot.details && typeof slot.details.suggestion === 'object' ? slot.details.suggestion : null;
    const suggestionName =
      suggestion && typeof suggestion.name === 'string' ? suggestion.name : '';
    if (!suggestionName.trim()) {
      return;
    }
    handlePlayerChange(runIndex, playerIndex, suggestionName);
  };

  const handleRunValueConfirm = (index) => {
    updateRun(index, (run) => ({
      ...run,
      valueField: run.valueField ? { ...run.valueField, confirmed: true } : run.valueField,
    }));
  };

  const handlePlayerConfirm = (runIndex, playerIndex) => {
    updateRun(runIndex, (run) => ({
      ...run,
      playerSlots: run.playerSlots.map((slot, currentIndex) =>
        currentIndex === playerIndex
          ? {
              ...slot,
              confirmed: true,
            }
          : slot,
      ),
    }));
  };

  const handleContextFieldConfirm = (fieldKey) => {
    setContextFields((previous) => {
      if (!previous || !previous[fieldKey]) {
        return previous;
      }
      return {
        ...previous,
        [fieldKey]: {
          ...previous[fieldKey],
          confirmed: true,
        },
      };
    });
  };

  const handleRemoveRun = (index) => {
    const confirmationMessage = t.contributeRunRemoveConfirm || 'Remove this run?';
    if (!window.confirm(confirmationMessage)) {
      return;
    }
    setRuns((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = async () => {
    resetFeedback();
    const runsWithContent = runs.filter((run) => hasRunContent(run));
    if (!runsWithContent.length) {
      setErrorKey('contributeNoResults');
      return;
    }
    if (!API_BASE_URL) {
      setErrorText('Missing API configuration.');
      return;
    }

    const unresolvedContextWarnings = ['dungeonField', 'modeField'].some((fieldKey) => {
      const field = contextFields?.[fieldKey];
      return field && field.status === 'warning' && !field.confirmed;
    });
    if (unresolvedContextWarnings) {
      setErrorKey('contributeWarningsPending');
      return;
    }

    const preparedRuns = runsWithContent.map((run) => {
      const week = toPositiveInteger(run.week);
      const dungeon = toPositiveInteger(run.dungeon);
      const score = toPositiveInteger(run.score);
      const time = toPositiveInteger(run.time);
      const expectedCount = Number.isFinite(run.expectedPlayerCount) && run.expectedPlayerCount > 0
        ? run.expectedPlayerCount
        : contextFields.expectedPlayerCount || DEFAULT_PLAYER_SLOTS;
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
          const id = Number.isFinite(slot.playerId) ? Number(slot.playerId) : null;
          return {
            player_name: name,
            id_player: id,
          };
        })
        .filter(Boolean);
      return {
        run,
        week,
        dungeon,
        score,
        time,
        players,
        expectedPlayerCount: expectedCount,
      };
    });

    const invalid = preparedRuns.some(({ week, dungeon, score, time, players }) => {
      if (!week || !dungeon) {
        return true;
      }
      const hasValue = (score && score > 0) || (time && time > 0);
      if (!hasValue) {
        return true;
      }
      return !players.length;
    });
    if (invalid) {
      setErrorKey('contributeValidationError');
      return;
    }

    const countMismatch = preparedRuns.some(({ players, expectedPlayerCount }) => players.length !== expectedPlayerCount);
    if (countMismatch) {
      setErrorKey('contributePlayerCountMismatch');
      return;
    }

    const unresolvedRunWarnings = preparedRuns.some(({ run }) => {
      const hasValueField = Boolean(
        (run.valueField?.text && run.valueField.text.trim()) ||
          (run.valueField?.normalized && run.valueField.normalized.trim()) ||
          (run.score && run.score !== '') ||
          (run.time && run.time !== ''),
      );
      const valueWarning = Boolean(
        run.valueField && run.valueField.status === 'warning' && !run.valueField.confirmed && hasValueField,
      );
      const playerWarning = run.playerSlots.some((slot) => {
        const name = typeof slot.value === 'string' ? slot.value.trim() : '';
        return slot.status === 'warning' && name && !slot.confirmed;
      });
      return valueWarning || playerWarning;
    });
    if (unresolvedRunWarnings) {
      setErrorKey('contributeWarningsPending');
      return;
    }

    const payload = preparedRuns.map(({ week, dungeon, score, time, players, expectedPlayerCount }) => ({
      week,
      dungeon,
      score,
      time,
      expected_player_count: expectedPlayerCount,
      players,
    }));

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
  const weekStatusClass = getStatusClass(contextFields.weekField.status, contextFields.weekField.confirmed);
  const dungeonStatusClass = getStatusClass(
    contextFields.dungeonField.status,
    contextFields.dungeonField.confirmed,
  );
  const modeStatusClass = getStatusClass(contextFields.modeField.status, contextFields.modeField.confirmed);
  const weekConfidenceLabel = getConfidenceLabel(contextFields.weekField.confidence);
  const dungeonConfidenceLabel = getConfidenceLabel(contextFields.dungeonField.confidence);
  const modeConfidenceLabel = getConfidenceLabel(contextFields.modeField.confidence);

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
              {selectedFiles.map((file, index) => {
                const label =
                  file.name ||
                  (file.file && file.file.name) ||
                  (typeof t.contributeImageFallback === 'function'
                    ? t.contributeImageFallback(index + 1)
                    : `Image ${index + 1}`);
                return (
                  <li key={`${label}-${index}`} className="contribute-file-item">
                    <span className="contribute-file-name">{label}</span>
                    <span className="contribute-file-meta">{`${file.width}×${file.height}`}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <div className="form-actions contribute-actions">
          <button
            type="button"
            onClick={handleExtract}
            disabled={!selectedFiles.length || status === 'extracting' || status === 'validating'}
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

      {(contextFields.weekField.crop || contextFields.dungeonField.crop || contextFields.modeField.crop || runs.length) ? (
        <section className="form contribute-context" aria-live="polite">
          <h2 className="contribute-section-title">{t.contributeContextTitle}</h2>
          <div className="contribute-context-grid">
            <div className={`contribute-context-item ${weekStatusClass}`}>
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
              {weekConfidenceLabel ? (
                <p className="contribute-confidence">{weekConfidenceLabel}</p>
              ) : null}
              <input
                type="number"
                min="1"
                value={contextFields.week === '' ? '' : contextFields.week}
                onChange={(event) => handleContextWeekChange(event.target.value)}
              />
            </div>
            <div className={`contribute-context-item ${dungeonStatusClass}`}>
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
              {dungeonConfidenceLabel ? (
                <p className="contribute-confidence">{dungeonConfidenceLabel}</p>
              ) : null}
              <p className="contribute-context-info">
                {typeof t.contributeDungeonExpectedPlayers === 'function'
                  ? t.contributeDungeonExpectedPlayers(contextFields.expectedPlayerCount)
                  : `${t.contributePlayers}: ${contextFields.expectedPlayerCount}`}
              </p>
              {contextFields.dungeonField.status === 'warning' ? (
                <p className="contribute-context-warning">
                  {t.contributeDungeonMissing || ''}
                </p>
              ) : null}
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
              {contextFields.dungeonField.status === 'warning' ? (
                <button
                  type="button"
                  className="status-action"
                  onClick={() => handleContextFieldConfirm('dungeonField')}
                  disabled={contextFields.dungeonField.confirmed}
                >
                  {contextFields.dungeonField.confirmed
                    ? t.contributeWarningConfirmed
                    : t.contributeWarningConfirm}
                </button>
              ) : null}
            </div>
            <div className={`contribute-context-item ${modeStatusClass}`}>
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
              {modeConfidenceLabel ? (
                <p className="contribute-confidence">{modeConfidenceLabel}</p>
              ) : null}
              <p className="contribute-context-mode">
                {contextFields.mode === 'TIME'
                  ? t.contributeModeTime
                  : contextFields.mode === 'SCORE'
                  ? t.contributeModeScore
                  : t.contributeModeUnknown}
              </p>
              {contextFields.modeField.status === 'warning' ? (
                <button
                  type="button"
                  className="status-action"
                  onClick={() => handleContextFieldConfirm('modeField')}
                  disabled={contextFields.modeField.confirmed}
                >
                  {contextFields.modeField.confirmed
                    ? t.contributeWarningConfirmed
                    : t.contributeWarningConfirm}
                </button>
              ) : null}
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
              const expectedPlayersLabel =
                typeof t.contributePlayersExpected === 'function'
                  ? t.contributePlayersExpected(run.expectedPlayerCount)
                  : `${t.contributePlayers} (${run.expectedPlayerCount ?? ''})`;
              const hasValueField = Boolean(
                (run.valueField?.text && run.valueField.text.trim()) ||
                  (run.valueField?.normalized && run.valueField.normalized.trim()) ||
                  (run.score && run.score !== '') ||
                  (run.time && run.time !== ''),
              );
              const valueStatusClass = hasValueField
                ? getStatusClass(run.valueField.status, run.valueField.confirmed)
                : '';
              const valueConfidenceLabel = getConfidenceLabel(run.valueField?.confidence);
              return (
                <article key={run.id} className="contribute-run">
                  <header className="contribute-run-header">
                    <h3>{label}</h3>
                    <span className="contribute-run-mode">{modeLabel}</span>
                    <button
                      type="button"
                      className="contribute-run-remove"
                      onClick={() => handleRemoveRun(runIndex)}
                      aria-label={t.contributeRunRemove || 'Remove run'}
                    >
                      ×
                    </button>
                  </header>
                  <div className={`contribute-run-value ${valueStatusClass}`}>
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
                    {valueConfidenceLabel ? (
                      <p className="contribute-confidence">{valueConfidenceLabel}</p>
                    ) : null}
                    {run.valueField.status === 'warning' && hasValueField ? (
                      <div className="contribute-field-warning">
                        <p className="form-hint">{t.contributeValueNeedsReview}</p>
                        <button
                          type="button"
                          className="status-action"
                          onClick={() => handleRunValueConfirm(runIndex)}
                          disabled={run.valueField.confirmed}
                        >
                          {run.valueField.confirmed
                            ? t.contributeWarningConfirmed
                            : t.contributeWarningConfirm}
                        </button>
                      </div>
                    ) : null}
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
                      <span>{expectedPlayersLabel}</span>
                      <p className="form-hint">{t.contributePlayersHint}</p>
                    </div>
                    <ul className="contribute-player-grid">
                      {run.playerSlots.map((slot, playerIndex) => {
                        const playerConfidenceLabel = getConfidenceLabel(slot.confidence);
                        const suggestion =
                          slot.details && typeof slot.details.suggestion === 'object'
                            ? slot.details.suggestion
                            : null;
                        const suggestionName =
                          suggestion && typeof suggestion.name === 'string' ? suggestion.name : '';
                        const suggestionLabel = suggestionName
                          ? typeof t.contributePlayerSuggestion === 'function'
                            ? t.contributePlayerSuggestion(suggestionName)
                            : t.contributePlayerSuggestion
                            ? `${t.contributePlayerSuggestion} ${suggestionName}`.trim()
                            : suggestionName
                          : '';
                        const suggestionActionLabel =
                          typeof t.contributePlayerApplySuggestion === 'function'
                            ? t.contributePlayerApplySuggestion(suggestionName)
                            : t.contributePlayerApplySuggestion || 'Use suggestion';
                        return (
                          <li
                            key={slot.key || playerIndex}
                            className={`contribute-player-slot ${getStatusClass(slot.status, slot.confirmed)}`}
                          >
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
                            {playerConfidenceLabel ? (
                              <p className="contribute-confidence contribute-confidence--player">
                                {playerConfidenceLabel}
                              </p>
                            ) : null}
                            {slot.status ? (
                              <p className="contribute-player-status">
                                {slot.status === 'success'
                                  ? t.contributePlayerExisting
                                  : t.contributePlayerNew}
                              </p>
                            ) : null}
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
                            {suggestionLabel && slot.status !== 'success' ? (
                              <div className="contribute-player-suggestion">
                                <p className="form-hint">{suggestionLabel}</p>
                                <button
                                  type="button"
                                  className="status-action"
                                  onClick={() => handlePlayerApplySuggestion(runIndex, playerIndex)}
                                >
                                  {suggestionActionLabel}
                                </button>
                              </div>
                            ) : null}
                            {slot.status === 'warning' && slot.value && slot.value.trim() ? (
                              <button
                                type="button"
                                className="status-action"
                                onClick={() => handlePlayerConfirm(runIndex, playerIndex)}
                                disabled={slot.confirmed}
                              >
                                {slot.confirmed
                                  ? t.contributeWarningConfirmed
                                  : t.contributeWarningConfirm}
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
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
