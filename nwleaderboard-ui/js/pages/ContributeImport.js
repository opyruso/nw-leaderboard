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

function runHasPendingValidation(run) {
  if (!run) {
    return false;
  }
  const hasValueField = Boolean(
    (run.valueField?.text && run.valueField.text.trim()) ||
      (run.valueField?.normalized && run.valueField.normalized.trim()) ||
      (run.score && run.score !== '') ||
      (run.time && run.time !== ''),
  );
  const valueWarning = Boolean(
    run.valueField &&
      run.valueField.status === 'warning' &&
      hasValueField &&
      !run.valueField.confirmed,
  );
  const playerWarning = Array.isArray(run.playerSlots)
    ? run.playerSlots.some((slot) => {
        const name = typeof slot.value === 'string' ? slot.value.trim() : '';
        return slot.status === 'warning' && !slot.confirmed && name;
      })
    : false;
  return valueWarning || playerWarning;
}

function resultHasPendingValidation(result) {
  if (!result || typeof result !== 'object') {
    return false;
  }
  const context = result?.context ? result.context : createEmptyContext();
  const contextWarning = ['weekField', 'dungeonField', 'modeField'].some((fieldKey) => {
    const field = context[fieldKey];
    return field && field.status === 'warning' && !field.confirmed;
  });
  if (contextWarning) {
    return true;
  }
  const runs = Array.isArray(result.runs) ? result.runs : [];
  return runs.some((run) => runHasPendingValidation(run));
}

export default function ContributeImport() {
  const { t, lang } = React.useContext(LangContext);
  const fileInputRef = React.useRef(null);
  const [selectedFiles, setSelectedFiles] = React.useState(() => []);
  const [fileResults, setFileResults] = React.useState([]);
  const [status, setStatus] = React.useState('idle');
  const [messageKey, setMessageKey] = React.useState('');
  const [messageText, setMessageText] = React.useState('');
  const [errorKey, setErrorKey] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [dungeons, setDungeons] = React.useState([]);
  const [loadingDungeons, setLoadingDungeons] = React.useState(false);
  const [dungeonError, setDungeonError] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(true);

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

  const getFileLabel = React.useCallback(
    (file, index) => {
      if (file && typeof file.name === 'string' && file.name.trim()) {
        return file.name;
      }
      if (file && file.file && typeof file.file.name === 'string' && file.file.name.trim()) {
        return file.file.name;
      }
      if (typeof t.contributeImageFallback === 'function') {
        return t.contributeImageFallback(index + 1);
      }
      return `Image ${index + 1}`;
    },
    [t],
  );

  const getFileStatusLabel = React.useCallback(
    (status) => {
      if (status === 'processing') {
        return t.contributeFileStatusProcessing || 'Processing';
      }
      if (status === 'success') {
        return t.contributeFileStatusSuccess || 'Ready';
      }
      if (status === 'error') {
        return t.contributeFileStatusError || 'Error';
      }
      return t.contributeFileStatusReady || 'Ready';
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
    setFileResults([]);
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
      const timestamp = Date.now();
      const enrichedMetadata = metadata.map((meta, index) => ({
        ...meta,
        id: `file-${timestamp}-${index}`,
        status: 'ready',
        errorMessage: '',
      }));
      setSelectedFiles(enrichedMetadata);
      if (enrichedMetadata.length === 1) {
        setMessageText('');
        setMessageKey('contributeFileReady');
      } else {
        setMessageKey('');
        const message =
          typeof t.contributeFilesReady === 'function'
            ? t.contributeFilesReady(enrichedMetadata.length)
            : `${enrichedMetadata.length} ${t.contributeFilesReady || 'images ready for extraction.'}`;
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
    setFileResults([]);
    resetFeedback();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateSelectedFile = (id, updater) => {
    setSelectedFiles((previous) =>
      previous.map((file) => {
        if (file.id !== id) {
          return file;
        }
        const updates = typeof updater === 'function' ? updater(file) : updater;
        if (!updates) {
          return file;
        }
        if (typeof updates === 'object') {
          return { ...file, ...updates };
        }
        return file;
      }),
    );
  };

  const modifyFileResult = (fileId, modifier) => {
    setFileResults((previous) =>
      previous.map((result) => {
        if (result.id !== fileId) {
          return result;
        }
        const next = typeof modifier === 'function' ? modifier(result) : null;
        if (!next || typeof next !== 'object') {
          return result;
        }
        return next;
      }),
    );
  };

  const updateRun = (fileId, runIndex, updater) => {
    modifyFileResult(fileId, (result) => {
      const currentRuns = Array.isArray(result.runs) ? result.runs : [];
      const updatedRuns = currentRuns.map((run, currentIndex) =>
        currentIndex === runIndex ? updater(run) : run,
      );
      return { ...result, runs: updatedRuns };
    });
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
      setFileResults([]);
      setSelectedFiles((previous) =>
        previous.map((file) => ({
          ...file,
          status: 'ready',
          errorMessage: '',
        })),
      );
      const nextResults = [];
      const timestampBase = Date.now();
      let successCount = 0;
      let failureCount = 0;
      let firstErrorMessage = '';

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const meta = selectedFiles[index];
        if (!meta || !meta.file) {
          continue;
        }
        updateSelectedFile(meta.id, { status: 'processing', errorMessage: '' });
        const formData = new FormData();
        const fileName = meta.name || (meta.file && meta.file.name) || `image-${index + 1}`;
        formData.append('image', meta.file, fileName);

        let responseData = null;
        let requestOk = false;
        let apiMessage = '';
        try {
          const response = await fetch(`${API_BASE_URL}/contributor/extract`, {
            method: 'POST',
            body: formData,
          });
          try {
            responseData = await response.json();
          } catch (error) {
            responseData = null;
          }
          if (!response.ok) {
            apiMessage = responseData && responseData.message ? responseData.message : '';
          } else {
            requestOk = true;
          }
        } catch (error) {
          apiMessage = '';
        }

        if (!requestOk) {
          failureCount += 1;
          if (apiMessage && !firstErrorMessage) {
            firstErrorMessage = apiMessage;
          }
          updateSelectedFile(meta.id, { status: 'error', errorMessage: apiMessage || '' });
          continue;
        }

        const context = normaliseExtractionContext(responseData || {});
        const runsForImage = buildRunsFromExtraction(responseData || {}, context, `${timestampBase}-${index}`);
        const runsWithContext = runsForImage.map((run) => ({
          ...run,
          week: context.week ?? run.week ?? '',
          dungeon: context.dungeon ?? run.dungeon ?? '',
          mode: run.mode || context.mode || '',
          expectedPlayerCount:
            Number.isFinite(run.expectedPlayerCount) && run.expectedPlayerCount > 0
              ? run.expectedPlayerCount
              : context.expectedPlayerCount || DEFAULT_PLAYER_SLOTS,
        }));
        nextResults.push({ id: meta.id, context, runs: runsWithContext });
        successCount += 1;
        updateSelectedFile(meta.id, { status: 'success', errorMessage: '' });
      }

      setFileResults(nextResults);

      const hasAnyContent = nextResults.some((result) =>
        Array.isArray(result.runs) ? result.runs.some((run) => hasRunContent(run)) : false,
      );

      if (successCount > 0) {
        if (hasAnyContent) {
          setMessageKey('contributeExtractionReady');
          setMessageText('');
        } else {
          setMessageKey('contributeNoResults');
          setMessageText('');
        }
        setErrorKey('');
        setErrorText('');
      } else if (failureCount > 0) {
        if (firstErrorMessage) {
          setErrorText(firstErrorMessage);
          setErrorKey('');
        } else {
          setErrorKey('contributeError');
          setErrorText('');
        }
        setMessageKey('');
        setMessageText('');
      }
    } catch (error) {
      console.warn('Unable to extract runs from the provided images', error);
      setErrorKey('contributeError');
      setMessageKey('');
      setMessageText('');
      setFileResults([]);
    } finally {
      setStatus('idle');
    }
  };

  const handleContextWeekChange = (fileId, value) => {
    const resolved = value === '' ? '' : toPositiveInteger(value) ?? '';
    modifyFileResult(fileId, (result) => {
      const currentContext = result?.context ? { ...result.context } : createEmptyContext();
      const updatedContext = { ...currentContext, week: resolved };
      const updatedRuns = Array.isArray(result.runs)
        ? result.runs.map((run) => ({ ...run, week: resolved }))
        : [];
      return { ...result, context: updatedContext, runs: updatedRuns };
    });
  };

  const handleContextDungeonChange = (fileId, value) => {
    const resolved = value === '' ? '' : toPositiveInteger(value) ?? '';
    const selectedDungeon = dungeons.find((item) => String(item.id) === String(resolved));
    const expectedFromSelection = Number.isFinite(selectedDungeon?.playerCount)
      ? Number(selectedDungeon.playerCount)
      : DEFAULT_PLAYER_SLOTS;
    const timestamp = Date.now();
    modifyFileResult(fileId, (result) => {
      const currentContext = result?.context ? { ...result.context } : createEmptyContext();
      const previousDungeonField = currentContext.dungeonField || normaliseField(null);
      const currentDetails = previousDungeonField.details ? { ...previousDungeonField.details } : {};
      if (expectedFromSelection) {
        currentDetails.player_count = expectedFromSelection;
      }
      const updatedDungeonField = {
        ...previousDungeonField,
        status: resolved ? 'success' : previousDungeonField.status,
        confirmed: true,
        details: Object.keys(currentDetails).length ? currentDetails : null,
      };
      const updatedContext = {
        ...currentContext,
        dungeon: resolved,
        expectedPlayerCount: expectedFromSelection,
        dungeonField: updatedDungeonField,
      };
      const updatedRuns = Array.isArray(result.runs)
        ? result.runs.map((run) =>
            applyExpectedPlayerCountToRun(
              {
                ...run,
                dungeon: resolved,
              },
              expectedFromSelection,
              timestamp,
            ),
          )
        : [];
      return { ...result, context: updatedContext, runs: updatedRuns };
    });
  };

  const handleScoreChange = (fileId, runIndex, value) => {
    updateRun(fileId, runIndex, (run) => ({
      ...run,
      score: value === '' ? '' : toPositiveInteger(value) ?? '',
      valueField: run.valueField
        ? { ...run.valueField, confirmed: false, status: 'warning' }
        : run.valueField,
    }));
  };

  const handleTimeChange = (fileId, runIndex, value) => {
    updateRun(fileId, runIndex, (run) => ({
      ...run,
      time: value === '' ? '' : toPositiveInteger(value) ?? '',
      valueField: run.valueField
        ? { ...run.valueField, confirmed: false, status: 'warning' }
        : run.valueField,
    }));
  };

  const handlePlayerChange = (fileId, runIndex, playerIndex, value) => {
    updateRun(fileId, runIndex, (run) => ({
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

  const handlePlayerApplySuggestion = (fileId, runIndex, playerIndex) => {
    const result = fileResults.find((item) => item.id === fileId);
    const run = result && Array.isArray(result.runs) ? result.runs[runIndex] : null;
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
    handlePlayerChange(fileId, runIndex, playerIndex, suggestionName);
  };

  const handleRunValueConfirm = (fileId, runIndex) => {
    updateRun(fileId, runIndex, (run) => ({
      ...run,
      valueField: run.valueField ? { ...run.valueField, confirmed: true } : run.valueField,
    }));
  };

  const handlePlayerConfirm = (fileId, runIndex, playerIndex) => {
    updateRun(fileId, runIndex, (run) => ({
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

  const handleContextFieldConfirm = (fileId, fieldKey) => {
    modifyFileResult(fileId, (result) => {
      const currentContext = result?.context ? { ...result.context } : createEmptyContext();
      if (!currentContext[fieldKey]) {
        return { ...result, context: currentContext };
      }
      return {
        ...result,
        context: {
          ...currentContext,
          [fieldKey]: {
            ...currentContext[fieldKey],
            confirmed: true,
          },
        },
      };
    });
  };

  const handleRemoveRun = (fileId, runIndex) => {
    const confirmationMessage = t.contributeRunRemoveConfirm || 'Remove this run?';
    if (!window.confirm(confirmationMessage)) {
      return;
    }
    modifyFileResult(fileId, (result) => {
      const currentRuns = Array.isArray(result.runs) ? result.runs : [];
      const updatedRuns = currentRuns.filter((_, currentIndex) => currentIndex !== runIndex);
      return { ...result, runs: updatedRuns };
    });
  };

  const handleSubmit = async () => {
    resetFeedback();
    const activeResults = fileResults.filter((result) =>
      Array.isArray(result.runs) && result.runs.some((run) => hasRunContent(run)),
    );
    if (!activeResults.length) {
      setErrorKey('contributeNoResults');
      return;
    }
    if (!API_BASE_URL) {
      setErrorText('Missing API configuration.');
      return;
    }

    const unresolvedContextWarnings = activeResults.some((result) => {
      const context = result?.context;
      if (!context) {
        return false;
      }
      return ['dungeonField', 'modeField'].some((fieldKey) => {
        const field = context[fieldKey];
        return field && field.status === 'warning' && !field.confirmed;
      });
    });
    if (unresolvedContextWarnings) {
      setErrorKey('contributeWarningsPending');
      return;
    }

    const runsWithContent = [];
    activeResults.forEach((result) => {
      const context = result?.context || createEmptyContext();
      const runsForResult = Array.isArray(result.runs) ? result.runs : [];
      runsForResult.forEach((run) => {
        if (hasRunContent(run)) {
          runsWithContent.push({ run, context });
        }
      });
    });

    const preparedRuns = runsWithContent.map(({ run, context }) => {
      const week = toPositiveInteger(run.week);
      const dungeon = toPositiveInteger(run.dungeon);
      const score = toPositiveInteger(run.score);
      const time = toPositiveInteger(run.time);
      const expectedCount = Number.isFinite(run.expectedPlayerCount) && run.expectedPlayerCount > 0
        ? run.expectedPlayerCount
        : context.expectedPlayerCount || DEFAULT_PLAYER_SLOTS;
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
      return { run, week, dungeon, score, time, players, expectedPlayerCount: expectedCount };
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
      setSelectedFiles([]);
      setFileResults([]);
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

  const orderedResults = React.useMemo(() => {
    const fromSelection = selectedFiles
      .map((file) => fileResults.find((result) => result.id === file.id))
      .filter(Boolean);
    const remaining = fileResults.filter(
      (result) => !selectedFiles.some((file) => file.id === result.id),
    );
    return fromSelection.concat(remaining);
  }, [selectedFiles, fileResults]);

  const resolvedError = errorText || (errorKey && t[errorKey] ? t[errorKey] : '');
  const resolvedMessage = messageText || (messageKey && t[messageKey] ? t[messageKey] : '');

  return (
    <section className="contribute-import">
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
                const label = getFileLabel(file, index);
                const statusKey = file.status || 'ready';
                const statusLabel = getFileStatusLabel(statusKey);
                const statusText =
                  statusKey === 'error' && file.errorMessage
                    ? `${statusLabel}: ${file.errorMessage}`
                    : statusLabel;
                return (
                  <li
                    key={file.id || `${label}-${index}`}
                    className={`contribute-file-item contribute-file-item--${statusKey}`}
                  >
                    <div className="contribute-file-details">
                      <span className="contribute-file-name">{label}</span>
                      <span className="contribute-file-meta">{`${file.width}×${file.height}`}</span>
                    </div>
                    <span className={`contribute-file-status contribute-file-status--${statusKey}`}>
                      {statusText}
                    </span>
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

      <section className="contribute-results-container" aria-live="polite">
        {loadingDungeons ? (
          <p className="form-hint">{t.contributeDungeonsLoading}</p>
        ) : null}
        {dungeonError ? (
          <p className="form-message" role="alert">
            {t.contributeDungeonsError}
          </p>
        ) : null}
        {orderedResults.length ? (
          <div
            className={`form contribute-results${showSuccess ? '' : ' contribute-results--hide-success'}`}
          >
            <div className="contribute-results-top">
              <h2 className="contribute-section-title">{t.contributeResultsTitle}</h2>
              <label className="contribute-toggle-success">
                <input
                  type="checkbox"
                  className="contribute-toggle-success-input"
                  checked={showSuccess}
                  onChange={(event) => setShowSuccess(event.target.checked)}
                />
                <span className="contribute-toggle-success-text">
                  {t.contributeToggleSuccessLabel}
                </span>
              </label>
            </div>
            {orderedResults.map((result, groupIndex) => {
              const fileIndex = selectedFiles.findIndex((file) => file.id === result.id);
              const displayIndex = fileIndex >= 0 ? fileIndex : groupIndex;
              const fileMeta = fileIndex >= 0 ? selectedFiles[fileIndex] : null;
              const fileLabel = getFileLabel(fileMeta, displayIndex);
              const context = result?.context ? result.context : createEmptyContext();
              const weekStatusClass = getStatusClass(
                context.weekField.status,
                context.weekField.confirmed,
              );
              const dungeonStatusClass = getStatusClass(
                context.dungeonField.status,
                context.dungeonField.confirmed,
              );
              const modeStatusClass = getStatusClass(
                context.modeField.status,
                context.modeField.confirmed,
              );
              const weekConfidenceLabel = getConfidenceLabel(context.weekField.confidence);
              const dungeonConfidenceLabel = getConfidenceLabel(context.dungeonField.confidence);
              const modeConfidenceLabel = getConfidenceLabel(context.modeField.confidence);
              const hasPendingValidation = resultHasPendingValidation(result);
              const hasAnyRunContent = Array.isArray(result.runs)
                ? result.runs.some((run) => hasRunContent(run))
                : false;
              const readyForSubmission = hasAnyRunContent && !hasPendingValidation;
              return (
                <article
                  key={result.id}
                  className={`contribute-file-result${readyForSubmission ? ' contribute-file-result--ready' : ''}`}
                >
                  <header className="contribute-file-result-header">
                    <h3>{fileLabel}</h3>
                    {fileMeta ? (
                      <span className="contribute-file-result-meta">
                        {`${fileMeta.width}×${fileMeta.height}`}
                      </span>
                    ) : null}
                  </header>
                  {readyForSubmission ? (
                    <p className="contribute-ready-message">{t.contributeReadyForSubmission}</p>
                  ) : null}
                  <div className="contribute-context-grid">
                    <div className={`contribute-context-item ${weekStatusClass}`}>
                      <span className="contribute-context-label">{t.contributeWeek}</span>
                      {context.weekField.crop ? (
                        <img
                          className="contribute-crop-image"
                          src={context.weekField.crop}
                          alt={t.contributeWeek}
                        />
                      ) : null}
                      <p className="contribute-context-ocr">
                        {context.weekField.text
                          ? t.contributeDetectedText(context.weekField.text)
                          : t.contributeDetectedEmpty}
                      </p>
                      {weekConfidenceLabel ? (
                        <p className="contribute-confidence">{weekConfidenceLabel}</p>
                      ) : null}
                      <input
                        type="number"
                        min="1"
                        value={context.week === '' ? '' : context.week}
                        onChange={(event) => handleContextWeekChange(result.id, event.target.value)}
                      />
                    </div>
                    <div className={`contribute-context-item ${dungeonStatusClass}`}>
                      <span className="contribute-context-label">{t.contributeDungeon}</span>
                      {context.dungeonField.crop ? (
                        <img
                          className="contribute-crop-image"
                          src={context.dungeonField.crop}
                          alt={t.contributeDungeon}
                        />
                      ) : null}
                      <p className="contribute-context-ocr">
                        {context.dungeonField.text
                          ? t.contributeDetectedText(context.dungeonField.text)
                          : t.contributeDetectedEmpty}
                      </p>
                      {dungeonConfidenceLabel ? (
                        <p className="contribute-confidence">{dungeonConfidenceLabel}</p>
                      ) : null}
                      <p className="contribute-context-info">
                        {typeof t.contributeDungeonExpectedPlayers === 'function'
                          ? t.contributeDungeonExpectedPlayers(context.expectedPlayerCount)
                          : `${t.contributePlayers}: ${context.expectedPlayerCount}`}
                      </p>
                      {context.dungeonField.status === 'warning' ? (
                        <p className="contribute-context-warning">
                          {t.contributeDungeonMissing || ''}
                        </p>
                      ) : null}
                      <select
                        value={context.dungeon === '' ? '' : String(context.dungeon)}
                        onChange={(event) => handleContextDungeonChange(result.id, event.target.value)}
                      >
                        <option value="">{t.contributeDungeonPlaceholder}</option>
                        {dungeons.map((dungeon) => (
                          <option key={dungeon.id} value={String(dungeon.id)}>
                            {dungeon.name}
                          </option>
                        ))}
                      </select>
                      {context.dungeonField.status === 'warning' ? (
                        <button
                          type="button"
                          className="status-action"
                          onClick={() => handleContextFieldConfirm(result.id, 'dungeonField')}
                          disabled={context.dungeonField.confirmed}
                        >
                          {context.dungeonField.confirmed
                            ? t.contributeWarningConfirmed
                            : t.contributeWarningConfirm}
                        </button>
                      ) : null}
                    </div>
                    <div className={`contribute-context-item ${modeStatusClass}`}>
                      <span className="contribute-context-label">{t.contributeMode}</span>
                      {context.modeField.crop ? (
                        <img
                          className="contribute-crop-image"
                          src={context.modeField.crop}
                          alt={t.contributeMode}
                        />
                      ) : null}
                      <p className="contribute-context-ocr">
                        {context.modeField.text
                          ? t.contributeDetectedText(context.modeField.text)
                          : t.contributeDetectedEmpty}
                      </p>
                      {modeConfidenceLabel ? (
                        <p className="contribute-confidence">{modeConfidenceLabel}</p>
                      ) : null}
                      <p className="contribute-context-mode">
                        {(context.mode || '').toUpperCase() === 'TIME'
                          ? t.contributeModeTime
                          : (context.mode || '').toUpperCase() === 'SCORE'
                          ? t.contributeModeScore
                          : t.contributeModeUnknown}
                      </p>
                      {context.modeField.status === 'warning' ? (
                        <button
                          type="button"
                          className="status-action"
                          onClick={() => handleContextFieldConfirm(result.id, 'modeField')}
                          disabled={context.modeField.confirmed}
                        >
                          {context.modeField.confirmed
                            ? t.contributeWarningConfirmed
                            : t.contributeWarningConfirm}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {Array.isArray(result.runs) && result.runs.length ? (
                    <div className="contribute-file-runs">
                      {result.runs.map((run, runIndex) => {
                        const label =
                          typeof t.contributeRunLabel === 'function'
                            ? t.contributeRunLabel(runIndex + 1)
                            : `${t.contributeResultsTitle} ${runIndex + 1}`;
                        const timePreview =
                          run.time && typeof t.contributeTimePreview === 'function'
                            ? t.contributeTimePreview(formatTime(run.time))
                            : '';
                        const modeValue = (run.mode || context.mode || '').toUpperCase();
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
                              onClick={() => handleRemoveRun(result.id, runIndex)}
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
                                  onClick={() => handleRunValueConfirm(result.id, runIndex)}
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
                                  onChange={(event) =>
                                    handleScoreChange(result.id, runIndex, event.target.value)
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>{t.contributeTime}</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={run.time === '' ? '' : run.time}
                                  onChange={(event) =>
                                    handleTimeChange(result.id, runIndex, event.target.value)
                                  }
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
                                  suggestion && typeof suggestion.name === 'string'
                                    ? suggestion.name
                                    : '';
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
                                    className={`contribute-player-slot ${getStatusClass(
                                      slot.status,
                                      slot.confirmed,
                                    )}`}
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
                                        handlePlayerChange(
                                          result.id,
                                          runIndex,
                                          playerIndex,
                                          event.target.value,
                                        )
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
                                          onClick={() =>
                                            handlePlayerApplySuggestion(
                                              result.id,
                                              runIndex,
                                              playerIndex,
                                            )
                                          }
                                        >
                                          {suggestionActionLabel}
                                        </button>
                                      </div>
                                    ) : null}
                                    {slot.status === 'warning' && slot.value && slot.value.trim() ? (
                                      <button
                                        type="button"
                                        className="status-action"
                                        onClick={() =>
                                          handlePlayerConfirm(result.id, runIndex, playerIndex)
                                        }
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
                    </div>
                  ) : null}
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
    </section>
  );
}
