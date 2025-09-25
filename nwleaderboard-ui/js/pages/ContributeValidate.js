import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
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

function shouldAutoConfirmField(field, threshold = 95) {
  if (!field || typeof field !== 'object') {
    return false;
  }
  if (field.status !== 'warning') {
    return false;
  }
  const rawConfidence = field.confidence;
  const numericConfidence =
    typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
      ? rawConfidence
      : typeof rawConfidence === 'string'
      ? Number.parseFloat(rawConfidence)
      : null;
  if (!Number.isFinite(numericConfidence)) {
    return false;
  }
  return numericConfidence >= threshold;
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
  const autoConfirmed = shouldAutoConfirmField(normalizedField);
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
    confirmed: autoConfirmed ? true : normalizedField.confirmed,
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
    let valueField = normaliseField(runSource.value);
    if (shouldAutoConfirmField(valueField)) {
      valueField = { ...valueField, confirmed: true };
    }
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

function createEmptyRun(context, runIndex, expectedCount, seed = Date.now()) {
  const resolvedContext = context && typeof context === 'object' ? context : createEmptyContext();
  const contextExpected = Number.isFinite(resolvedContext.expectedPlayerCount)
    ? Number(resolvedContext.expectedPlayerCount)
    : DEFAULT_PLAYER_SLOTS;
  const safeExpected = Number.isFinite(expectedCount) && expectedCount > 0 ? Number(expectedCount) : contextExpected;
  const baseRun = {
    id: `run-${seed}-${runIndex}`,
    index: runIndex,
    week: resolvedContext.week ?? '',
    dungeon: resolvedContext.dungeon ?? '',
    score: '',
    time: '',
    mode: resolvedContext.mode ?? '',
    valueField: normaliseField(null),
    playerSlots: [],
    expectedPlayerCount: safeExpected,
  };
  return applyExpectedPlayerCountToRun(baseRun, safeExpected, seed);
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

function formatConfidenceLabel(t, confidence) {
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
}

export default function ContributeValidate() {
  const { t, lang } = React.useContext(LangContext);
  const [dungeons, setDungeons] = React.useState([]);
  const [loadingDungeons, setLoadingDungeons] = React.useState(false);
  const [dungeonError, setDungeonError] = React.useState(false);
  const [scans, setScans] = React.useState([]);
  const [loadingScans, setLoadingScans] = React.useState(false);
  const [scansError, setScansError] = React.useState(false);
  const [selectedScanId, setSelectedScanId] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [status, setStatus] = React.useState('idle');
  const [messageKey, setMessageKey] = React.useState('');
  const [messageText, setMessageText] = React.useState('');
  const [errorKey, setErrorKey] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [showSuccess, setShowSuccess] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const getConfidenceLabel = React.useCallback((confidence) => formatConfidenceLabel(t, confidence), [t]);

  const resetFeedback = React.useCallback(() => {
    setMessageKey('');
    setMessageText('');
    setErrorKey('');
    setErrorText('');
  }, []);

  const loadDungeons = React.useCallback(() => {
    if (!API_BASE_URL) {
      setDungeons([]);
      setDungeonError(true);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoadingDungeons(true);
    setDungeonError(false);
    fetch(`${API_BASE_URL}/dungeons`, {
      headers: {
        'Accept-Language': toLocaleHeader(lang),
      },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('dungeons');
        }
        return response.json();
      })
      .then((data) => {
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
      })
      .catch(() => {
        if (!cancelled) {
          setDungeons([]);
          setDungeonError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDungeons(false);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lang]);

  React.useEffect(() => loadDungeons(), [loadDungeons]);

  React.useEffect(() => {
    if (!API_BASE_URL) {
      setScans([]);
      setScansError(true);
      return;
    }
    let cancelled = false;
    setLoadingScans(true);
    setScansError(false);
    fetch(`${API_BASE_URL}/contributor/scans`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('scans');
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setScans(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScans([]);
          setScansError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingScans(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const findDungeonLabel = React.useCallback(
    (id) => {
      if (id === null || id === undefined) {
        return '';
      }
      const match = dungeons.find((item) => String(item.id) === String(id));
      return match ? match.name : String(id);
    },
    [dungeons],
  );

  const updateResult = React.useCallback((updater) => {
    setResult((current) => {
      if (!current) {
        return current;
      }
      const updated = updater(current);
      return updated || current;
    });
  }, []);

  const handleContextWeekChange = (value) => {
    const resolved = value === '' ? '' : toPositiveInteger(value) ?? '';
    updateResult((current) => {
      const currentContext = current?.context ? { ...current.context } : createEmptyContext();
      const updatedContext = { ...currentContext, week: resolved };
      const updatedRuns = Array.isArray(current.runs)
        ? current.runs.map((run) => ({ ...run, week: resolved }))
        : [];
      return { ...current, context: updatedContext, runs: updatedRuns };
    });
  };

  const handleContextDungeonChange = (value) => {
    const resolved = value === '' ? '' : toPositiveInteger(value) ?? '';
    const selectedDungeon = dungeons.find((item) => String(item.id) === String(resolved));
    const expectedFromSelection = Number.isFinite(selectedDungeon?.playerCount)
      ? Number(selectedDungeon.playerCount)
      : DEFAULT_PLAYER_SLOTS;
    const timestamp = Date.now();
    updateResult((current) => {
      const currentContext = current?.context ? { ...current.context } : createEmptyContext();
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
      const updatedRuns = Array.isArray(current.runs)
        ? current.runs.map((run) =>
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
      return { ...current, context: updatedContext, runs: updatedRuns };
    });
  };

  const handleScoreChange = (runIndex, value) => {
    updateResult((current) => ({
      ...current,
      runs: current.runs.map((run, index) => {
        if (index !== runIndex) {
          return run;
        }
        return {
          ...run,
          score: value === '' ? '' : toPositiveInteger(value) ?? '',
          valueField: run.valueField
            ? { ...run.valueField, confirmed: false, status: 'warning' }
            : run.valueField,
        };
      }),
    }));
  };

  const handleTimeChange = (runIndex, value) => {
    updateResult((current) => ({
      ...current,
      runs: current.runs.map((run, index) => {
        if (index !== runIndex) {
          return run;
        }
        return {
          ...run,
          time: value === '' ? '' : toPositiveInteger(value) ?? '',
          valueField: run.valueField
            ? { ...run.valueField, confirmed: false, status: 'warning' }
            : run.valueField,
        };
      }),
    }));
  };

  const handlePlayerChange = (runIndex, playerIndex, value) => {
    updateResult((current) => ({
      ...current,
      runs: current.runs.map((run, index) => {
        if (index !== runIndex) {
          return run;
        }
        return {
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
        };
      }),
    }));
  };

  const handlePlayerConfirm = (runIndex, playerIndex) => {
    updateResult((current) => ({
      ...current,
      runs: current.runs.map((run, index) => {
        if (index !== runIndex) {
          return run;
        }
        return {
          ...run,
          playerSlots: run.playerSlots.map((slot, currentIndex) =>
            currentIndex === playerIndex
              ? {
                  ...slot,
                  confirmed: true,
                }
              : slot,
          ),
        };
      }),
    }));
  };

  const handlePlayerApplySuggestion = (runIndex, playerIndex) => {
    setResult((current) => {
      if (!current) {
        return current;
      }
      const run = current.runs[runIndex];
      if (!run) {
        return current;
      }
      const slot = Array.isArray(run.playerSlots) ? run.playerSlots[playerIndex] : null;
      if (!slot) {
        return current;
      }
      const suggestion = slot.details && typeof slot.details.suggestion === 'object' ? slot.details.suggestion : null;
      const suggestionName = suggestion && typeof suggestion.name === 'string' ? suggestion.name : '';
      const suggestionId = suggestion && Number.isFinite(Number(suggestion.id)) ? Number(suggestion.id) : null;
      const trimmed = suggestionName ? suggestionName.trim() : '';
      if (!trimmed) {
        return current;
      }
      const updatedSlots = run.playerSlots.map((playerSlot, index) => {
        if (index !== playerIndex) {
          return playerSlot;
        }
        return {
          ...playerSlot,
          value: trimmed,
          normalized: trimmed,
          playerId: Number.isFinite(suggestionId) ? Number(suggestionId) : null,
          status: 'success',
          alreadyExists: true,
          confirmed: true,
        };
      });
      const updatedRuns = current.runs.map((playerRun, index) =>
        index === runIndex ? { ...playerRun, playerSlots: updatedSlots } : playerRun,
      );
      return { ...current, runs: updatedRuns };
    });
  };

  const handleRunValueConfirm = (runIndex) => {
    updateResult((current) => ({
      ...current,
      runs: current.runs.map((run, index) => {
        if (index !== runIndex) {
          return run;
        }
        return {
          ...run,
          valueField: run.valueField ? { ...run.valueField, confirmed: true } : run.valueField,
        };
      }),
    }));
  };

  const handleExpectedPlayerCountChange = (runIndex, value) => {
    const resolved = value === '' ? DEFAULT_PLAYER_SLOTS : toPositiveInteger(value) ?? DEFAULT_PLAYER_SLOTS;
    const timestamp = Date.now();
    updateResult((current) => ({
      ...current,
      runs: current.runs.map((run, index) => {
        if (index !== runIndex) {
          return run;
        }
        return applyExpectedPlayerCountToRun({ ...run, expectedPlayerCount: resolved }, resolved, timestamp);
      }),
    }));
  };

  const handleRunRemove = React.useCallback(
    (runIndex) => {
      const confirmationMessage =
        typeof t.contributeRunRemoveConfirm === 'function'
          ? t.contributeRunRemoveConfirm(runIndex + 1)
          : t.contributeRunRemoveConfirm;
      if (confirmationMessage && typeof window !== 'undefined' && !window.confirm(confirmationMessage)) {
        return;
      }
      updateResult((current) => {
        if (!current || !Array.isArray(current.runs) || !current.runs[runIndex]) {
          return current;
        }
        const context = current.context || createEmptyContext();
        const existingRun = current.runs[runIndex];
        const expected = Number.isFinite(existingRun?.expectedPlayerCount) && existingRun.expectedPlayerCount > 0
          ? Number(existingRun.expectedPlayerCount)
          : null;
        const seed = Date.now();
        const clearedRun = createEmptyRun(context, runIndex, expected, seed);
        const updatedRuns = current.runs.map((run, index) => (index === runIndex ? clearedRun : run));
        return { ...current, runs: updatedRuns };
      });
    },
    [t, updateResult],
  );

  const handleModeConfirm = (fieldKey) => {
    updateResult((current) => {
      if (!current?.context) {
        return current;
      }
      const updatedContext = { ...current.context };
      if (updatedContext[fieldKey]) {
        updatedContext[fieldKey] = { ...updatedContext[fieldKey], confirmed: true };
      }
      return { ...current, context: updatedContext };
    });
  };

  const buildSubmissionPayload = () => {
    if (!result) {
      return [];
    }
    const context = result.context ? { ...result.context } : createEmptyContext();
    const runs = Array.isArray(result.runs) ? result.runs : [];
    const preparedRuns = runs
      .map((run) => {
        const players = run.playerSlots.map((slot) => {
          const normalized = typeof slot.normalized === 'string' ? slot.normalized.trim() : '';
          const fallback = typeof slot.value === 'string' ? slot.value.trim() : '';
          const playerName = normalized || fallback;
          return {
            player_name: playerName,
            id_player: Number.isFinite(slot.playerId) ? Number(slot.playerId) : null,
          };
        });
        const expectedPlayerCount = Number.isFinite(run.expectedPlayerCount) ? Number(run.expectedPlayerCount) : null;
        return {
          run,
          week: context.week || run.week || '',
          dungeon: context.dungeon || run.dungeon || '',
          score: run.score === '' ? null : run.score,
          time: run.time === '' ? null : run.time,
          expectedPlayerCount,
          players,
        };
      })
      .filter(({ week, dungeon, score, time, players }) => {
        const hasPlayers = players.some((player) => player.player_name);
        return Boolean(week && dungeon && (score || time || hasPlayers));
      });
    return preparedRuns;
  };

  const handleSubmit = async () => {
    resetFeedback();
    const preparedRuns = buildSubmissionPayload();
    if (!preparedRuns.length) {
      setErrorKey('contributeNothingToSubmit');
      return;
    }
    const unresolvedContextWarnings = resultHasPendingValidation(result);
    if (unresolvedContextWarnings) {
      setErrorKey('contributeWarningsPending');
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

      if (selectedScanId) {
        try {
          await fetch(`${API_BASE_URL}/contributor/scans/${selectedScanId}`, {
            method: 'DELETE',
          });
        } catch (error) {
          console.warn('Unable to delete stored scan after submission', error);
        }
      }

      setScans((current) => current.filter((scan) => scan.id !== selectedScanId));
      setSelectedScanId(null);
      setResult(null);
      setMessageKey('contributeSuccess');
    } catch (error) {
      console.warn('Unable to submit the extracted runs', error);
      setErrorKey('contributeError');
    } finally {
      setStatus('idle');
    }
  };

  const loadScanDetail = async (scanId) => {
    if (!API_BASE_URL || !scanId) {
      return;
    }
    resetFeedback();
    setLoadingDetail(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contributor/scans/${scanId}`);
      if (!response.ok) {
        throw new Error('scan');
      }
      const detail = await response.json();
      const extraction = detail?.extraction || {};
      const context = normaliseExtractionContext(extraction);
      const runs = buildRunsFromExtraction(extraction, context, `${scanId}-${Date.now()}`).map((run) => ({
        ...run,
        week: context.week ?? run.week ?? '',
        dungeon: context.dungeon ?? run.dungeon ?? '',
        mode: run.mode || context.mode || '',
        expectedPlayerCount:
          Number.isFinite(run.expectedPlayerCount) && run.expectedPlayerCount > 0
            ? run.expectedPlayerCount
            : context.expectedPlayerCount || DEFAULT_PLAYER_SLOTS,
      }));
      setResult({
        id: detail.id,
        context,
        runs,
        width: detail.width,
        height: detail.height,
        picture: detail.picture || '',
        leaderboardType: detail.leaderboard_type || '',
      });
      setSelectedScanId(detail.id);
    } catch (error) {
      console.warn('Unable to load stored scan detail', error);
      setErrorKey('contributeValidateLoadError');
      setSelectedScanId(null);
      setResult(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const resolvedError = errorText || (errorKey && t[errorKey] ? t[errorKey] : '');
  const resolvedMessage = messageText || (messageKey && t[messageKey] ? t[messageKey] : '');

  const readyForSubmission = result && Array.isArray(result.runs)
    ? result.runs.some((run) => hasRunContent(run)) && !resultHasPendingValidation(result)
    : false;

  return (
    <section className="contribute-validate">
      <p className="page-description">{t.contributeValidateDescription}</p>
      <div className="contribute-validate-layout">
        <section className="form contribute-form" aria-live="polite">
          <h2 className="contribute-section-title">{t.contributeValidateListTitle}</h2>
          {loadingScans ? <p className="form-hint">{t.contributeValidateLoading}</p> : null}
          {scansError ? (
            <p className="form-message" role="alert">
              {t.contributeValidateLoadError}
            </p>
          ) : null}
          {!loadingScans && !scans.length ? (
            <p className="form-hint">{t.contributeValidateEmpty}</p>
          ) : null}
          <ul className="contribute-file-list contribute-scan-list">
            {scans.map((scan) => {
              const labelWeek = scan.week
                ? `${t.contributeWeek} ${scan.week}`
                : t.contributeWeekUnknown || t.contributeWeek;
              const dungeonLabel = findDungeonLabel(scan.dungeon_id);
              const typeLabel = scan.leaderboard_type || '';
              const isActive = selectedScanId === scan.id;
              return (
                <li
                  key={scan.id}
                  className={`contribute-file-item contribute-file-item--${isActive ? 'success' : 'ready'}`}
                >
                  <div className="contribute-file-details">
                    <span className="contribute-file-name">{labelWeek}</span>
                    <span className="contribute-file-meta">{dungeonLabel}</span>
                  </div>
                  <button
                    type="button"
                    className="contribute-file-status contribute-file-status--ready"
                    onClick={() => loadScanDetail(scan.id)}
                    disabled={loadingDetail && selectedScanId === scan.id}
                  >
                    {loadingDetail && selectedScanId === scan.id
                      ? t.contributeValidateLoading
                      : typeLabel || t.contributeValidateSelect}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="contribute-results-container" aria-live="polite">
          {loadingDungeons ? <p className="form-hint">{t.contributeDungeonsLoading}</p> : null}
          {dungeonError ? (
            <p className="form-message" role="alert">
              {t.contributeDungeonsError}
            </p>
          ) : null}
          {result ? (
            <div className={`form contribute-results${showSuccess ? '' : ' contribute-results--hide-success'}`}>
              <div className="contribute-results-top">
                <h2 className="contribute-section-title">{t.contributeResultsTitle}</h2>
                <label className="contribute-toggle-success">
                  <input
                    type="checkbox"
                    className="contribute-toggle-success-input"
                    checked={showSuccess}
                    onChange={(event) => setShowSuccess(event.target.checked)}
                  />
                  <span className="contribute-toggle-success-text">{t.contributeToggleSuccessLabel}</span>
                </label>
              </div>
              <article
                className={`contribute-file-result${readyForSubmission ? ' contribute-file-result--ready' : ''}`}
              >
                <header className="contribute-file-result-header">
                  <h3>{t.contributeValidateSelected}</h3>
                  <span className="contribute-file-result-meta">{`${result.width}×${result.height}`}</span>
                </header>
                {readyForSubmission ? (
                  <p className="contribute-ready-message">{t.contributeReadyForSubmission}</p>
                ) : null}
                <div className="contribute-context-grid">
                  <div className={`contribute-context-item ${getStatusClass(
                    result.context.weekField.status,
                    result.context.weekField.confirmed,
                  )}`}>
                    <span className="contribute-context-label">{t.contributeWeek}</span>
                    {result.context.weekField.crop ? (
                      <img
                        className="contribute-crop-image"
                        src={result.context.weekField.crop}
                        alt={t.contributeWeek}
                      />
                    ) : null}
                    <p className="contribute-context-ocr">
                      {result.context.weekField.text
                        ? t.contributeDetectedText(result.context.weekField.text)
                        : t.contributeDetectedEmpty}
                    </p>
                    {(() => {
                      const confidenceLabel = getConfidenceLabel(result.context.weekField.confidence);
                      return confidenceLabel ? (
                        <p className="contribute-confidence">{confidenceLabel}</p>
                      ) : null;
                    })()}
                    <label className="form-field">
                      <span>{t.contributeWeek}</span>
                      <input
                        type="number"
                        min="1"
                        value={result.context.week === '' ? '' : result.context.week}
                        onChange={(event) => handleContextWeekChange(event.target.value)}
                      />
                    </label>
                    {result.context.weekField.status === 'warning' && !result.context.weekField.confirmed ? (
                      <div className="contribute-field-warning">
                        <p className="form-hint">{t.contributeWarningReview}</p>
                        <button
                          type="button"
                          className="status-action"
                          onClick={() => handleModeConfirm('weekField')}
                        >
                          {t.contributeWarningConfirm}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className={`contribute-context-item ${getStatusClass(
                    result.context.dungeonField.status,
                    result.context.dungeonField.confirmed,
                  )}`}>
                    <span className="contribute-context-label">{t.contributeDungeon}</span>
                    {result.context.dungeonField.crop ? (
                      <img
                        className="contribute-crop-image"
                        src={result.context.dungeonField.crop}
                        alt={t.contributeDungeon}
                      />
                    ) : null}
                    <p className="contribute-context-ocr">
                      {result.context.dungeonField.text
                        ? t.contributeDetectedText(result.context.dungeonField.text)
                        : t.contributeDetectedEmpty}
                    </p>
                    <label className="form-field">
                      <span>{t.contributeDungeon}</span>
                      <select
                        value={result.context.dungeon === '' ? '' : result.context.dungeon}
                        onChange={(event) => handleContextDungeonChange(event.target.value)}
                      >
                        <option value="">{t.contributeSelectDungeon}</option>
                        {dungeons.map((dungeon) => (
                          <option key={dungeon.id} value={dungeon.id}>
                            {dungeon.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {result.context.dungeonField.status === 'warning' && !result.context.dungeonField.confirmed ? (
                      <div className="contribute-field-warning">
                        <p className="form-hint">{t.contributeWarningReview}</p>
                        <button
                          type="button"
                          className="status-action"
                          onClick={() => handleModeConfirm('dungeonField')}
                        >
                          {t.contributeWarningConfirm}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className={`contribute-context-item ${getStatusClass(
                    result.context.modeField.status,
                    result.context.modeField.confirmed,
                  )}`}>
                    <span className="contribute-context-label">{t.contributeMode}</span>
                    {result.context.modeField.crop ? (
                      <img
                        className="contribute-crop-image"
                        src={result.context.modeField.crop}
                        alt={t.contributeMode}
                      />
                    ) : null}
                    <p className="contribute-context-ocr">
                      {result.context.modeField.text
                        ? t.contributeDetectedText(result.context.modeField.text)
                        : t.contributeDetectedEmpty}
                    </p>
                    {(() => {
                      const confidenceLabel = getConfidenceLabel(result.context.modeField.confidence);
                      return confidenceLabel ? (
                        <p className="contribute-confidence">{confidenceLabel}</p>
                      ) : null;
                    })()}
                    {result.context.modeField.status === 'warning' && !result.context.modeField.confirmed ? (
                      <div className="contribute-field-warning">
                        <p className="form-hint">{t.contributeWarningReview}</p>
                        <button
                          type="button"
                          className="status-action"
                          onClick={() => handleModeConfirm('modeField')}
                        >
                          {t.contributeWarningConfirm}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="contribute-file-runs">
                  {result.runs.map((run, runIndex) => {
                    const expectedPlayersLabel =
                      typeof t.contributePlayersExpected === 'function'
                        ? t.contributePlayersExpected(run.expectedPlayerCount)
                        : `${t.contributePlayers} (${run.expectedPlayerCount ?? ''})`;
                    const valueStatusClass = getStatusClass(run.valueField?.status, run.valueField?.confirmed);
                    const hasValueField = Boolean(
                      (run.valueField?.text && run.valueField.text.trim()) ||
                        (run.valueField?.normalized && run.valueField.normalized.trim()) ||
                        (run.score && run.score !== '') ||
                        (run.time && run.time !== ''),
                    );
                    const valueConfidenceLabel = getConfidenceLabel(run.valueField?.confidence);
                    const timePreview = formatTime(run.time);
                    return (
                      <section key={run.id} className="contribute-run">
                        <header className="contribute-run-header">
                          <h3>{t.contributeRunLabel(runIndex + 1)}</h3>
                          <div className="contribute-run-tools">
                            <button
                              type="button"
                              className="contribute-run-remove"
                              onClick={() => handleRunRemove(runIndex)}
                            >
                              {typeof t.contributeRunRemove === 'function'
                                ? t.contributeRunRemove(runIndex + 1)
                                : t.contributeRunRemove}
                            </button>
                            <label className="form-field contribute-expected-field">
                              <span>{t.contributePlayers}</span>
                              <input
                                type="number"
                                min="1"
                                value={run.expectedPlayerCount}
                                onChange={(event) => handleExpectedPlayerCountChange(runIndex, event.target.value)}
                              />
                            </label>
                          </div>
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
                                    onChange={(event) =>
                                      handlePlayerChange(runIndex, playerIndex, event.target.value)
                                    }
                                  />
                                  {suggestionLabel ? (
                                    <p className="contribute-player-suggestion">{suggestionLabel}</p>
                                  ) : null}
                                  {suggestionName ? (
                                    <button
                                      type="button"
                                      className="status-action"
                                      onClick={() => handlePlayerApplySuggestion(runIndex, playerIndex)}
                                    >
                                      {suggestionActionLabel}
                                    </button>
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
                      </section>
                    );
                  })}
                </div>
                <div className="form-actions contribute-actions">
                  <button type="button" onClick={handleSubmit} disabled={status === 'submitting'}>
                    {status === 'submitting' ? t.contributeSubmitting : t.contributeSubmit}
                  </button>
                </div>
              </article>
            </div>
          ) : (
            <p className="form-hint">{t.contributeValidateSelect}</p>
          )}
        </section>
      </div>
      <section className="form-messages" aria-live="polite">
        {resolvedMessage ? (
          <p className="form-message" role="status">
            {resolvedMessage}
          </p>
        ) : null}
        {resolvedError ? (
          <p className="form-message" role="alert">
            {resolvedError}
          </p>
        ) : null}
      </section>
    </section>
  );
}
