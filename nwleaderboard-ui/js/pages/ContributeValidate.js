import { LangContext } from '../i18n.js';
import { normaliseRegionList, translateRegion } from '../regions.js';

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
  let confirmed = true;
  if (typeof field.confirmed === 'boolean') {
    confirmed = field.confirmed;
  } else if (status === 'warning') {
    confirmed = false;
  }
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
  const fallbackRegions = React.useMemo(() => normaliseRegionList(), []);
  const [dungeons, setDungeons] = React.useState([]);
  const [loadingDungeons, setLoadingDungeons] = React.useState(false);
  const [dungeonError, setDungeonError] = React.useState(false);
  const [scans, setScans] = React.useState([]);
  const [loadingScans, setLoadingScans] = React.useState(false);
  const [scansError, setScansError] = React.useState(false);
  const [selectedScanId, setSelectedScanId] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [regions, setRegions] = React.useState(fallbackRegions);
  const [selectedRegion, setSelectedRegion] = React.useState(() =>
    fallbackRegions.length ? fallbackRegions[0] : '',
  );
  const [status, setStatus] = React.useState('idle');
  const [expandedGroups, setExpandedGroups] = React.useState({});
  const [messageKey, setMessageKey] = React.useState('');
  const [messageText, setMessageText] = React.useState('');
  const [errorKey, setErrorKey] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [showSuccess, setShowSuccess] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [compactView, setCompactView] = React.useState(false);
  const [savingDraft, setSavingDraft] = React.useState(false);
  const [rescanning, setRescanning] = React.useState(false);
  const [deletingScan, setDeletingScan] = React.useState(false);
  const [groupOffsets, setGroupOffsets] = React.useState(() => Array(5).fill('0'));
  const [showPictureModal, setShowPictureModal] = React.useState(false);

  const getConfidenceLabel = React.useCallback((confidence) => formatConfidenceLabel(t, confidence), [t]);

  const resetFeedback = React.useCallback(() => {
    setMessageKey('');
    setMessageText('');
    setErrorKey('');
    setErrorText('');
  }, []);

  const handleGroupOffsetChange = React.useCallback((index, value) => {
    setGroupOffsets((current) => {
      const next = Array.isArray(current) ? [...current] : [];
      while (next.length < 5) {
        next.push('0');
      }
      next[index] = value;
      return next;
    });
  }, []);

  const resultRegion = result?.region || '';
  const offsetsLabel =
    typeof t.contributeRescanOffsetsLabel === 'string'
      ? t.contributeRescanOffsetsLabel
      : 'Offsets (px)';
  const resultPicture = typeof result?.picture === 'string' ? result.picture : '';
  const hasResultPicture = Boolean(resultPicture);
  const resultId = result?.id || null;
  const getGroupOffsetLabel = React.useCallback(
    (groupIndex) => {
      if (typeof t.contributeRescanGroupOffsetLabel === 'function') {
        return t.contributeRescanGroupOffsetLabel(groupIndex);
      }
      return `Group ${groupIndex} offset (px)`;
    },
    [t],
  );

  React.useEffect(() => {
    setShowPictureModal(false);
  }, [resultId]);

  const handleOpenPicture = React.useCallback(() => {
    if (resultPicture) {
      setShowPictureModal(true);
    }
  }, [resultPicture]);

  const handleClosePicture = React.useCallback(() => {
    setShowPictureModal(false);
  }, []);
  const originalPictureAlt =
    typeof t.contributeOriginalScreenshotAlt === 'string'
      ? t.contributeOriginalScreenshotAlt
      : t.contributeResultsTitle;

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const applyRegions = (list) => {
      if (!active) {
        return;
      }
      const normalised = normaliseRegionList(list, fallbackRegions);
      setRegions(normalised);
      setSelectedRegion((current) => {
        if (current && normalised.includes(current)) {
          return current;
        }
        return normalised.length ? normalised[0] : current || '';
      });
    };

    if (!API_BASE_URL) {
      applyRegions(fallbackRegions);
      return () => {
        active = false;
        controller.abort();
      };
    }

    fetch(`${API_BASE_URL}/contributor/regions`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load regions: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        applyRegions(data);
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') {
          return;
        }
        console.warn('Unable to load contributor regions', error);
        applyRegions(fallbackRegions);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [API_BASE_URL, fallbackRegions]);

  React.useEffect(() => {
    if (!regions.length) {
      return;
    }
    const preferred = resultRegion || selectedRegion;
    const nextRegion = preferred && regions.includes(preferred)
      ? preferred
      : regions[0];
    if (selectedRegion !== nextRegion) {
      setSelectedRegion(nextRegion);
    }
    if (result && result.region !== nextRegion) {
      setResult((current) => (current ? { ...current, region: nextRegion } : current));
    }
  }, [regions, result, resultRegion, selectedRegion]);

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

  const handleRegionSelectChange = React.useCallback(
    (event) => {
      const value = typeof event?.target?.value === 'string' ? event.target.value : '';
      const normalised = value.trim().toUpperCase();
      const resolved = normalised || (regions.length ? regions[0] : '');
      setSelectedRegion(resolved);
      setResult((current) => (current ? { ...current, region: resolved } : current));
    },
    [regions],
  );

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
          const normalised = Array.isArray(data)
            ? data
                .map((item) => {
                  if (!item || typeof item !== 'object') {
                    return null;
                  }
                  const regionId =
                    typeof item.region === 'string' ? item.region.trim().toUpperCase() : '';
                  return { ...item, region: regionId };
                })
                .filter(Boolean)
            : [];
          setScans(normalised);
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

  const groupedScans = React.useMemo(() => {
    if (!Array.isArray(scans) || !scans.length) {
      return [];
    }
    const groups = new Map();
    scans.forEach((scan) => {
      if (!scan) {
        return;
      }
      const rawDungeonId = Number.isFinite(scan.dungeon_id)
        ? Number(scan.dungeon_id)
        : Number.isFinite(Number(scan.dungeon_id))
        ? Number(scan.dungeon_id)
        : null;
      const normalizedDungeonId = rawDungeonId && rawDungeonId > 0 ? rawDungeonId : null;
      const key = normalizedDungeonId !== null ? String(normalizedDungeonId) : 'unknown';
      if (!groups.has(key)) {
        const label = normalizedDungeonId !== null
          ? findDungeonLabel(normalizedDungeonId)
          : t.contributeDungeonUnknown || 'Unknown';
        groups.set(key, {
          key,
          dungeonId: normalizedDungeonId,
          label,
          scans: [],
        });
      }
      const entry = groups.get(key);
      entry.scans.push(scan);
    });
    return Array.from(groups.values());
  }, [scans, findDungeonLabel, t]);

  React.useEffect(() => {
    setExpandedGroups((current) => {
      const next = { ...current };
      let changed = false;
      const validKeys = new Set();
      groupedScans.forEach((group) => {
        validKeys.add(group.key);
        if (next[group.key] === undefined) {
          next[group.key] = true;
          changed = true;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!validKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [groupedScans]);

  React.useEffect(() => {
    setGroupOffsets(Array(5).fill('0'));
  }, [selectedScanId]);

  const updateResult = React.useCallback((updater) => {
    setResult((current) => {
      if (!current) {
        return current;
      }
      const updated = updater(current);
      return updated || current;
    });
  }, []);

  const toFieldExtractionPayload = React.useCallback((field) => {
    if (!field || typeof field !== 'object') {
      return null;
    }
    const text = typeof field.text === 'string' ? field.text.trim() || null : null;
    const normalized = typeof field.normalized === 'string' ? field.normalized.trim() || null : null;
    const number = Number.isFinite(field.number) ? Number(field.number) : null;
    const id = Number.isFinite(field.id) ? Number(field.id) : null;
    const crop = typeof field.crop === 'string' && field.crop ? field.crop : null;
    const confidence = Number.isFinite(field.confidence) ? Number(field.confidence) : null;
    const status = typeof field.status === 'string' && field.status ? field.status : null;
    const alreadyExists = typeof field.alreadyExists === 'boolean' ? field.alreadyExists : null;
    const confirmed = typeof field.confirmed === 'boolean' ? field.confirmed : null;
    const details = field.details && typeof field.details === 'object' ? { ...field.details } : null;
    const payload = {
      text,
      normalized,
      number,
      id,
      crop,
      confidence,
      status,
      already_exists: alreadyExists,
      details,
      confirmed,
    };
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });
    return payload;
  }, []);

  const buildExtractionSavePayload = React.useCallback(() => {
    if (!result) {
      return null;
    }
    const context = result.context ? { ...result.context } : createEmptyContext();
    const weekNumber = context.week === '' ? null : toPositiveInteger(context.week);
    const dungeonNumber = context.dungeon === '' ? null : toPositiveInteger(context.dungeon);
    const expectedPlayerCount = Number.isFinite(context.expectedPlayerCount)
      ? Number(context.expectedPlayerCount)
      : null;

    const weekFieldSource = context.weekField ? { ...context.weekField } : normaliseField(null);
    if (weekNumber !== null) {
      weekFieldSource.number = weekNumber;
      weekFieldSource.normalized = String(weekNumber);
    }

    const dungeonFieldSource = context.dungeonField ? { ...context.dungeonField } : normaliseField(null);
    if (dungeonNumber !== null) {
      dungeonFieldSource.id = dungeonNumber;
      dungeonFieldSource.number = dungeonNumber;
      dungeonFieldSource.normalized = String(dungeonNumber);
    }

    const modeFieldSource = context.modeField ? { ...context.modeField } : normaliseField(null);

    const runs = Array.isArray(result.runs)
      ? result.runs.map((run, index) => {
          const score = run.score === '' ? null : toPositiveInteger(run.score);
          const time = run.time === '' ? null : toPositiveInteger(run.time);
          const expected = Number.isFinite(run.expectedPlayerCount)
            ? Number(run.expectedPlayerCount)
            : expectedPlayerCount;
          const players = Array.isArray(run.playerSlots)
            ? run.playerSlots.map((slot) => {
                const trimmed = typeof slot.value === 'string' ? slot.value.trim() : '';
                return toFieldExtractionPayload({
                  text: slot.rawText || null,
                  normalized: trimmed || null,
                  number: null,
                  id: Number.isFinite(slot.playerId) ? Number(slot.playerId) : null,
                  crop: slot.crop || null,
                  confidence: slot.confidence,
                  status: slot.status || null,
                  alreadyExists: typeof slot.alreadyExists === 'boolean' ? slot.alreadyExists : null,
                  details: slot.details ? { ...slot.details } : null,
                  confirmed: typeof slot.confirmed === 'boolean' ? slot.confirmed : null,
                });
              })
            : [];
          return {
            index: Number.isFinite(run.index) ? Number(run.index) : index,
            mode: typeof run.mode === 'string' && run.mode ? run.mode : null,
            score,
            time,
            value: toFieldExtractionPayload(run.valueField),
            players,
            expected_player_count: expected,
          };
        })
      : [];

    return {
      week: toFieldExtractionPayload(weekFieldSource),
      dungeon: toFieldExtractionPayload(dungeonFieldSource),
      mode: toFieldExtractionPayload(modeFieldSource),
      expected_player_count: expectedPlayerCount,
      runs,
    };
  }, [result, toFieldExtractionPayload]);

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

  const handleContextModeChange = (value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const resolved = trimmed ? trimmed.toUpperCase() : '';
    updateResult((current) => {
      const currentContext = current?.context ? { ...current.context } : createEmptyContext();
      const updatedContext = { ...currentContext, mode: resolved };
      const updatedRuns = Array.isArray(current.runs)
        ? current.runs.map((run) => ({ ...run, mode: resolved }))
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
        const remainingRuns = current.runs.filter((_, index) => index !== runIndex);
        if (!remainingRuns.length) {
          return { ...current, runs: remainingRuns };
        }
        const context = current.context || createEmptyContext();
        const fallbackExpected =
          Number.isFinite(context.expectedPlayerCount) && context.expectedPlayerCount > 0
            ? Number(context.expectedPlayerCount)
            : DEFAULT_PLAYER_SLOTS;
        const updatedRuns = remainingRuns.map((run, index) => {
          const expected =
            Number.isFinite(run?.expectedPlayerCount) && run.expectedPlayerCount > 0
              ? Number(run.expectedPlayerCount)
              : fallbackExpected;
          const playerSlots = Array.isArray(run?.playerSlots)
            ? run.playerSlots.map((slot, slotIndex) => ({
                ...slot,
                slotIndex,
              }))
            : [];
          return {
            ...run,
            index,
            expectedPlayerCount: expected,
            playerSlots,
          };
        });
        return { ...current, runs: updatedRuns };
      });
    },
    [t, updateResult],
  );

  const renderRuns = () => {
    if (!result || !Array.isArray(result.runs)) {
      return null;
    }
    if (compactView) {
      const compactRows = [];
      const addCompactEntry = ({
        key,
        statusClass,
        crop,
        alt,
        extracted,
        inputs,
        inputsClassName,
        suggestionLabel,
        onSuggestionClick,
        showConfirmButton,
        confirmDisabled,
        confirmAction,
      }) => {
        const baseRowClass = ['contribute-compact-row', statusClass].filter(Boolean).join(' ');
        compactRows.push(
          <tr key={key} className={baseRowClass}>
            <td className="contribute-compact-cell contribute-compact-cell--image">
              <div className="contribute-compact-image-frame">
                {crop ? (
                  <img className="contribute-crop-image contribute-compact-image" src={crop} alt={alt} />
                ) : null}
              </div>
            </td>
            <td className="contribute-compact-cell contribute-compact-cell--extracted">
              {extracted ? <span className="contribute-compact-extracted">{extracted}</span> : null}
            </td>
            <td className="contribute-compact-cell contribute-compact-cell--inputs">
              <div className={`contribute-compact-inputs${inputsClassName ? ` ${inputsClassName}` : ''}`}>
                {inputs}
              </div>
            </td>
            <td className="contribute-compact-cell contribute-compact-cell--confirm">
              {showConfirmButton ? (
                <button
                  type="button"
                  className="status-action"
                  onClick={confirmAction}
                  disabled={confirmDisabled}
                >
                  {confirmDisabled ? t.contributeWarningConfirmed : t.contributeWarningConfirm}
                </button>
              ) : null}
            </td>
            <td className="contribute-compact-cell contribute-compact-cell--suggestion">
              {suggestionLabel && onSuggestionClick ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="contribute-compact-suggestion"
                  onClick={onSuggestionClick}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSuggestionClick();
                    }
                  }}
                >
                  {suggestionLabel}
                </span>
              ) : null}
            </td>
          </tr>,
        );
      };

      const contextEntries = [
        {
          key: 'context-week',
          statusClass: getStatusClass(result.context.weekField.status, result.context.weekField.confirmed),
          crop: result.context.weekField.crop,
          alt: t.contributeWeek,
          extracted: result.context.weekField.text
            ? t.contributeDetectedText(result.context.weekField.text)
            : t.contributeDetectedEmpty,
          inputs: (
            <input
              type="number"
              min="1"
              value={result.context.week === '' ? '' : result.context.week}
              onChange={(event) => handleContextWeekChange(event.target.value)}
            />
          ),
          showConfirmButton:
            result.context.weekField.status === 'warning' && !result.context.weekField.confirmed,
          confirmDisabled: result.context.weekField.confirmed,
          confirmAction: () => handleModeConfirm('weekField'),
        },
        {
          key: 'context-dungeon',
          statusClass: getStatusClass(result.context.dungeonField.status, result.context.dungeonField.confirmed),
          crop: result.context.dungeonField.crop,
          alt: t.contributeDungeon,
          extracted: result.context.dungeonField.text
            ? t.contributeDetectedText(result.context.dungeonField.text)
            : t.contributeDetectedEmpty,
          inputs: (
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
          ),
          showConfirmButton:
            result.context.dungeonField.status === 'warning' && !result.context.dungeonField.confirmed,
          confirmDisabled: result.context.dungeonField.confirmed,
          confirmAction: () => handleModeConfirm('dungeonField'),
        },
        {
          key: 'context-mode',
          statusClass: getStatusClass(result.context.modeField.status, result.context.modeField.confirmed),
          crop: result.context.modeField.crop,
          alt: t.contributeMode,
          extracted: result.context.modeField.text
            ? t.contributeDetectedText(result.context.modeField.text)
            : t.contributeDetectedEmpty,
          inputs: (
            <input
              type="text"
              value={result.context.mode || ''}
              onChange={(event) => handleContextModeChange(event.target.value)}
            />
          ),
          showConfirmButton:
            result.context.modeField.status === 'warning' && !result.context.modeField.confirmed,
          confirmDisabled: result.context.modeField.confirmed,
          confirmAction: () => handleModeConfirm('modeField'),
        },
      ];

      contextEntries.forEach((entry) => addCompactEntry(entry));

      result.runs.forEach((run, runIndex) => {
        const valueStatusClass = getStatusClass(run.valueField?.status, run.valueField?.confirmed);
        const hasValueField = Boolean(
          (run.valueField?.text && run.valueField.text.trim()) ||
            (run.valueField?.normalized && run.valueField.normalized.trim()) ||
            (run.score && run.score !== '') ||
            (run.time && run.time !== ''),
        );
        const extractedValue =
          run.valueField?.normalized?.trim() || run.valueField?.text?.trim() || '—';
        const timePlaceholder = typeof t.contributeTime === 'string' ? t.contributeTime : undefined;
        const scorePlaceholder = typeof t.contributeScore === 'string' ? t.contributeScore : undefined;
        addCompactEntry({
          key: `${run.id}-value`,
          statusClass: valueStatusClass,
          crop: run.valueField.crop,
          alt: t.contributeValueArea,
          extracted: extractedValue,
          inputs: (
            <>
              <input
                type="number"
                min="0"
                value={run.score === '' ? '' : run.score}
                placeholder={scorePlaceholder}
                aria-label={t.contributeScore}
                onChange={(event) => handleScoreChange(runIndex, event.target.value)}
              />
              <input
                type="number"
                min="0"
                value={run.time === '' ? '' : run.time}
                placeholder={timePlaceholder}
                aria-label={t.contributeTime}
                onChange={(event) => handleTimeChange(runIndex, event.target.value)}
              />
            </>
          ),
          inputsClassName: 'contribute-compact-inputs--dual',
          showConfirmButton: run.valueField.status === 'warning' && hasValueField,
          confirmDisabled: run.valueField.confirmed,
          confirmAction: () => handleRunValueConfirm(runIndex),
        });

        run.playerSlots.forEach((slot, playerIndex) => {
          const suggestion =
            slot.details && typeof slot.details.suggestion === 'object'
              ? slot.details.suggestion
              : null;
          const suggestionName = suggestion && typeof suggestion.name === 'string' ? suggestion.name : '';
          const extractedPlayerValue = slot.rawText?.trim() ? slot.rawText.trim() : '—';
          addCompactEntry({
            key: `${run.id}-${slot.key || `player-${playerIndex}`}`,
            statusClass: getStatusClass(slot.status, slot.confirmed),
            crop: slot.crop,
            alt: t.contributePlayerSlotLabel(playerIndex + 1),
            extracted: extractedPlayerValue,
            inputs: (
              <input
                type="text"
                value={slot.value || ''}
                placeholder={t.contributePlayerSlotLabel(playerIndex + 1)}
                onChange={(event) => handlePlayerChange(runIndex, playerIndex, event.target.value)}
              />
            ),
            suggestionLabel: suggestionName || null,
            onSuggestionClick: suggestionName
              ? () => handlePlayerApplySuggestion(runIndex, playerIndex)
              : null,
            showConfirmButton: slot.status === 'warning' && slot.value && slot.value.trim(),
            confirmDisabled: slot.confirmed,
            confirmAction: () => handlePlayerConfirm(runIndex, playerIndex),
          });
        });
      });

      return (
        <div className="contribute-compact-table-wrapper contribute-compact-table-wrapper--full">
          <table className="contribute-compact-table">
            <thead>
              <tr>
                <th scope="col">{t.contributeCompactImage}</th>
                <th scope="col">{t.contributeCompactExtracted}</th>
                <th scope="col">{t.contributeCompactInput}</th>
                <th scope="col">{t.contributeCompactAction}</th>
                <th scope="col">{t.contributeCompactSuggestion}</th>
              </tr>
            </thead>
            <tbody>{compactRows}</tbody>
          </table>
        </div>
      );
    }
    return result.runs.map((run, runIndex) => {
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
      const removeLabel =
        typeof t.contributeRunRemove === 'function'
          ? t.contributeRunRemove(runIndex + 1)
          : t.contributeRunRemove || 'Remove run';
      return (
        <section key={run.id} className="contribute-run">
          <header className="contribute-run-header">
            <h3>{t.contributeRunLabel(runIndex + 1)}</h3>
            <div className="contribute-run-tools">
              <button
                type="button"
                className="contribute-run-remove"
                aria-label={removeLabel}
                title={removeLabel}
                onClick={() => handleRunRemove(runIndex)}
              >
                <span className="visually-hidden">{removeLabel}</span>
                <svg
                  className="contribute-run-remove-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    fill="currentColor"
                    d="M10 3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1h5v2H5V4h5V3Zm-1 6v10h2V9H9Zm4 0v10h2V9h-2Zm-6 0H7v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9h-1v10H7V9Z"
                  />
                </svg>
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
              <img className="contribute-crop-image" src={run.valueField.crop} alt={t.contributeValueArea} />
            ) : null}
            <p className="contribute-context-ocr">
              {run.valueField.text
                ? t.contributeDetectedText(run.valueField.text)
                : t.contributeDetectedEmpty}
            </p>
            {valueConfidenceLabel ? <p className="contribute-confidence">{valueConfidenceLabel}</p> : null}
            {run.valueField.status === 'warning' && hasValueField ? (
              <div className="contribute-field-warning">
                <p className="form-hint">{t.contributeValueNeedsReview}</p>
                <button
                  type="button"
                  className="status-action"
                  onClick={() => handleRunValueConfirm(runIndex)}
                  disabled={run.valueField.confirmed}
                >
                  {run.valueField.confirmed ? t.contributeWarningConfirmed : t.contributeWarningConfirm}
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
                const suggestionName = suggestion && typeof suggestion.name === 'string' ? suggestion.name : '';
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
                      <p className="contribute-confidence contribute-confidence--player">{playerConfidenceLabel}</p>
                    ) : null}
                    {slot.status ? (
                      <p className="contribute-player-status">
                        {slot.status === 'success' ? t.contributePlayerExisting : t.contributePlayerNew}
                      </p>
                    ) : null}
                    <input
                      type="text"
                      value={slot.value || ''}
                      onChange={(event) => handlePlayerChange(runIndex, playerIndex, event.target.value)}
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
                        {slot.confirmed ? t.contributeWarningConfirmed : t.contributeWarningConfirm}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      );
    });
  };

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
    const resolvedRegion = resultRegion || selectedRegion || (regions.length ? regions[0] : '');
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
          region: resolvedRegion,
        };
      })
      .filter(({ week, dungeon, score, time, players }) => {
        const hasPlayers = players.some((player) => player.player_name);
        return Boolean(week && dungeon && (score || time || hasPlayers));
      });
    return preparedRuns;
  };

  const applyScanDetail = React.useCallback(
    (detail) => {
      if (!detail) {
        return;
      }
      const extraction = detail?.extraction || {};
      const context = normaliseExtractionContext(extraction);
      const runs = buildRunsFromExtraction(extraction, context, `${detail.id}-${Date.now()}`).map((run) => ({
        ...run,
        week: context.week ?? run.week ?? '',
        dungeon: context.dungeon ?? run.dungeon ?? '',
        mode: run.mode || context.mode || '',
        expectedPlayerCount:
          Number.isFinite(run.expectedPlayerCount) && run.expectedPlayerCount > 0
            ? run.expectedPlayerCount
            : context.expectedPlayerCount || DEFAULT_PLAYER_SLOTS,
      }));
      const detailRegion =
        typeof detail.region === 'string' ? detail.region.trim().toUpperCase() : '';
      const mergedRegions = normaliseRegionList([...regions, detailRegion], fallbackRegions);
      const preferredRegion = detailRegion || selectedRegion;
      const resolvedRegion = preferredRegion && mergedRegions.includes(preferredRegion)
        ? preferredRegion
        : mergedRegions.length
        ? mergedRegions[0]
        : '';
      setRegions(mergedRegions);
      setSelectedRegion(resolvedRegion);
      setResult({
        id: detail.id,
        context,
        runs,
        width: detail.width,
        height: detail.height,
        picture: detail.picture || '',
        leaderboardType: detail.leaderboard_type || detail.leaderboardType || '',
        region: resolvedRegion,
      });
      setSelectedScanId(detail.id);
    },
    [fallbackRegions, regions, selectedRegion],
  );

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

    const payload = preparedRuns.map(({ week, dungeon, score, time, players, expectedPlayerCount, region }) => ({
      week,
      dungeon,
      score,
      time,
      expected_player_count: expectedPlayerCount,
      players,
      region,
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

  const handleSaveProgress = async () => {
    if (!API_BASE_URL || !selectedScanId || !result) {
      return;
    }
    resetFeedback();
    const extractionPayload = buildExtractionSavePayload();
    if (!extractionPayload) {
      return;
    }
    const context = result.context ? result.context : createEmptyContext();
    const weekValue = context.week === '' ? null : toPositiveInteger(context.week);
    const dungeonValue = context.dungeon === '' ? null : toPositiveInteger(context.dungeon);
    const regionValue = resultRegion || selectedRegion || (regions.length ? regions[0] : '');
    const payload = {
      week: weekValue,
      dungeon_id: dungeonValue,
      leaderboard_type: result.leaderboardType || null,
      region: regionValue || null,
      extraction: extractionPayload,
    };

    setSavingDraft(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contributor/scans/${selectedScanId}`, {
        method: 'PUT',
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
          setErrorKey('contributeSaveError');
        }
        return;
      }

      if (data) {
        applyScanDetail(data);
        setScans((current) =>
          current.map((scan) => {
            if (scan.id !== data.id) {
              return scan;
            }
            return {
              ...scan,
              week: data.week ?? scan.week,
              dungeon_id: data.dungeon_id ?? data.dungeonId ?? scan.dungeon_id,
              leaderboard_type: data.leaderboard_type ?? data.leaderboardType ?? scan.leaderboard_type,
              region: regionValue || scan.region,
            };
          }),
        );
      }
      setMessageKey('contributeSaveSuccess');
    } catch (error) {
      console.warn('Unable to save validation progress', error);
      setErrorKey('contributeSaveError');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleRescan = async () => {
    if (!API_BASE_URL || !selectedScanId) {
      return;
    }
    resetFeedback();
    const sanitizedOffsets = Array.from({ length: 5 }, (_, index) => {
      const raw = index < groupOffsets.length ? groupOffsets[index] : '0';
      if (typeof raw !== 'string') {
        return 0;
      }
      const trimmed = raw.trim();
      if (trimmed === '') {
        return 0;
      }
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
    const regionValue = resultRegion || selectedRegion || (regions.length ? regions[0] : '');
    setRescanning(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contributor/scans/${selectedScanId}/rescan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ offsets: sanitizedOffsets, region: regionValue || null }),
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
          setErrorKey('contributeRescanError');
        }
        return;
      }
      if (data) {
        applyScanDetail(data);
        setScans((current) =>
          current.map((scan) => {
            if (!scan || scan.id !== data.id) {
              return scan;
            }
            return {
              ...scan,
              week: data.week ?? scan.week,
              dungeon_id: data.dungeon_id ?? data.dungeonId ?? scan.dungeon_id,
              leaderboard_type: data.leaderboard_type ?? data.leaderboardType ?? scan.leaderboard_type,
              region:
                (typeof data.region === 'string' ? data.region.trim().toUpperCase() : '') || scan.region,
            };
          }),
        );
      }
      setMessageKey('contributeRescanSuccess');
    } catch (error) {
      console.warn('Unable to rescan stored leaderboard scan', error);
      setErrorKey('contributeRescanError');
    } finally {
      setRescanning(false);
    }
  };

  const handleDeleteScan = async () => {
    if (!API_BASE_URL || !selectedScanId || deletingScan) {
      return;
    }
    const confirmationMessage =
      typeof t.contributeDeleteConfirm === 'string'
        ? t.contributeDeleteConfirm
        : 'Are you sure you want to delete this scan? This action cannot be undone.';
    const confirmed = window.confirm(confirmationMessage);
    if (!confirmed) {
      return;
    }

    resetFeedback();
    setDeletingScan(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contributor/scans/${selectedScanId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        let data = null;
        try {
          data = await response.json();
        } catch (error) {
          data = null;
        }
        const apiMessage = data && data.message ? data.message : null;
        if (apiMessage) {
          setErrorText(apiMessage);
        } else {
          setErrorKey('contributeDeleteError');
        }
        return;
      }

      setScans((current) => current.filter((scan) => scan && scan.id !== selectedScanId));
      setSelectedScanId(null);
      setResult(null);
      setMessageKey('contributeDeleteSuccess');
    } catch (error) {
      console.warn('Unable to delete stored leaderboard scan', error);
      setErrorKey('contributeDeleteError');
    } finally {
      setDeletingScan(false);
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
      applyScanDetail(detail);
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
      {showPictureModal && hasResultPicture ? (
        <div className="contribute-picture-modal" onClick={handleClosePicture} role="presentation">
          <img
            className="contribute-picture-modal-image"
            src={resultPicture}
            alt={originalPictureAlt}
          />
        </div>
      ) : null}
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
          {groupedScans.length ? (
            <ul className="contribute-file-list contribute-scan-list contribute-scan-list--grouped">
              {groupedScans.map((group) => {
                const isExpanded = expandedGroups[group.key] !== false;
                const countLabel =
                  typeof t.contributeScansGroupCount === 'function'
                    ? t.contributeScansGroupCount(group.scans.length)
                    : `${group.scans.length}`;
                const groupTitle = group.label || t.contributeDungeonUnknown || 'Unknown';
                return (
                  <li
                    key={group.key}
                    className={`contribute-scan-group${isExpanded ? ' contribute-scan-group--open' : ''}`}
                  >
                    <button
                      type="button"
                      className="contribute-scan-group-header"
                      onClick={() =>
                        setExpandedGroups((current) => ({
                          ...current,
                          [group.key]: !(current[group.key] !== false),
                        }))
                      }
                      aria-expanded={isExpanded}
                    >
                      <span className="contribute-scan-group-title">{groupTitle}</span>
                      <span className="contribute-scan-group-count">{countLabel}</span>
                      <span className="contribute-scan-group-icon" aria-hidden="true">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </button>
                    {isExpanded ? (
                      <ul className="contribute-scan-group-list">
                        {group.scans.map((scan) => {
                          const labelWeek = scan.week
                            ? `${t.contributeWeek} ${scan.week}`
                            : t.contributeWeekUnknown || t.contributeWeek;
                          const dungeonLabel = findDungeonLabel(scan.dungeon_id);
                          const typeLabel = scan.leaderboard_type || '';
                          const regionLabel =
                            scan.region && typeof scan.region === 'string'
                              ? translateRegion(t, scan.region)
                              : '';
                          const isActive = selectedScanId === scan.id;
                          return (
                            <li
                              key={scan.id}
                              className={`contribute-file-item contribute-file-item--${isActive ? 'success' : 'ready'}`}
                            >
                              <div className="contribute-file-details">
                                <span className="contribute-file-name">{labelWeek}</span>
                                <span className="contribute-file-meta">
                                  {regionLabel ? `[${regionLabel}] ` : ''}
                                  {dungeonLabel}
                                </span>
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
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : !loadingScans && !scansError ? (
            <p className="form-hint">{t.contributeValidateEmpty}</p>
          ) : null}
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
                <div className="contribute-results-heading">
                  {hasResultPicture ? (
                    <button
                      type="button"
                      className="contribute-results-picture-button"
                      onClick={handleOpenPicture}
                      title={originalPictureAlt}
                    >
                      <img
                        className="contribute-results-picture-thumb"
                        src={resultPicture}
                        alt={originalPictureAlt}
                      />
                    </button>
                  ) : null}
                  <h2 className="contribute-section-title">{t.contributeResultsTitle}</h2>
                </div>
                <div className="contribute-results-actions">
                  {selectedScanId ? (
                    <>
                      <div className="contribute-rescan-offsets">
                        <span className="contribute-rescan-offsets-label">{offsetsLabel}</span>
                        <div className="contribute-rescan-offsets-fields">
                          {Array.from({ length: 5 }).map((_, index) => {
                            const value = index < groupOffsets.length ? groupOffsets[index] : '0';
                            const inputLabel = getGroupOffsetLabel(index + 1);
                            return (
                              <label key={`group-offset-${index}`} className="form-field contribute-rescan-offset-field">
                                <span>{inputLabel}</span>
                                <input
                                  type="number"
                                  value={value}
                                  onChange={(event) => handleGroupOffsetChange(index, event.target.value)}
                                  disabled={rescanning || loadingDetail}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="contribute-rescan-button"
                        onClick={handleRescan}
                        disabled={rescanning || loadingDetail}
                      >
                        {rescanning ? t.contributeRescanning : t.contributeRescan}
                      </button>
                    </>
                  ) : null}
                  <label className="contribute-toggle-success">
                    <input
                      type="checkbox"
                      className="contribute-toggle-success-input"
                      checked={showSuccess}
                      onChange={(event) => setShowSuccess(event.target.checked)}
                    />
                    <span className="contribute-toggle-success-text">{t.contributeToggleSuccessLabel}</span>
                  </label>
                  <label className="contribute-toggle-compact">
                    <input
                      type="checkbox"
                      className="contribute-toggle-success-input"
                      checked={compactView}
                      onChange={(event) => setCompactView(event.target.checked)}
                    />
                    <span className="contribute-toggle-success-text">{t.contributeToggleCompactLabel}</span>
                  </label>
                </div>
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
                <label className="form-field contribute-region-select">
                  <span>{t.contributeRegionLabel || 'Region'}</span>
                  <select value={selectedRegion} onChange={handleRegionSelectChange}>
                    {regions.map((region) => (
                      <option key={region} value={region}>
                        {translateRegion(t, region)}
                      </option>
                    ))}
                  </select>
                </label>
                {!compactView ? (
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
                ) : null}
                <div className="contribute-file-runs">{renderRuns()}</div>
                <div className="form-actions contribute-actions">
                  <button
                    type="button"
                    onClick={handleSaveProgress}
                    disabled={savingDraft || !selectedScanId}
                  >
                    {savingDraft ? t.contributeSaving : t.contributeSaveProgress}
                  </button>
                  <button type="button" onClick={handleSubmit} disabled={status === 'submitting'}>
                    {status === 'submitting' ? t.contributeSubmitting : t.contributeSubmit}
                  </button>
                </div>
              </article>
              {selectedScanId ? (
                <div className="form-actions contribute-delete-actions">
                  <button
                    type="button"
                    className="danger"
                    onClick={handleDeleteScan}
                    disabled={
                      deletingScan ||
                      loadingDetail ||
                      rescanning ||
                      savingDraft ||
                      status === 'submitting'
                    }
                  >
                    {deletingScan ? t.contributeDeleting : t.contributeDelete}
                  </button>
                </div>
              ) : null}
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
