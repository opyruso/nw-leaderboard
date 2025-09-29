export const SEASON_STORAGE_PREFIX = 'nwleaderboard:season:';

function parseSeasonBoundary(value, endOfDay = false) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const hasTimeComponent = /[tT]/.test(trimmed);
  const isoString = hasTimeComponent ? trimmed : `${trimmed}T00:00:00Z`;
  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) {
    return null;
  }
  if (!endOfDay) {
    return parsed;
  }
  if (hasTimeComponent) {
    const date = new Date(parsed);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }
  const oneDay = 24 * 60 * 60 * 1000;
  return parsed + oneDay - 1;
}

function normaliseStoredSeasonId(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

export function loadStoredSeasonId(storageKey) {
  if (!storageKey || typeof window === 'undefined' || !window.localStorage) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
      return undefined;
    }
    return normaliseStoredSeasonId(JSON.parse(raw));
  } catch (error) {
    return undefined;
  }
}

export function saveStoredSeasonId(storageKey, seasonId) {
  if (!storageKey || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (seasonId === undefined) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    const payload = seasonId === null ? null : String(seasonId);
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    // ignore storage errors
  }
}

export function normaliseSeason(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const idValue = Number(entry.id ?? entry.season_id ?? entry.seasonId);
  const id = Number.isFinite(idValue) ? idValue : null;
  const dateBegin = entry.dateBegin ?? entry.date_begin ?? entry.startDate ?? null;
  const dateEnd = entry.dateEnd ?? entry.date_end ?? entry.endDate ?? null;
  if (id === null) {
    return null;
  }
  return { id, dateBegin: dateBegin || null, dateEnd: dateEnd || null };
}

export function sortSeasons(seasons) {
  if (!Array.isArray(seasons) || seasons.length === 0) {
    return [];
  }
  const items = seasons
    .map((season) => normaliseSeason(season))
    .filter((season) => season && season.id !== null);
  items.sort((left, right) => {
    if (left.dateBegin && right.dateBegin && left.dateBegin !== right.dateBegin) {
      return right.dateBegin.localeCompare(left.dateBegin);
    }
    return right.id - left.id;
  });
  return items;
}

export function findCurrentSeasonId(seasons, referenceDate = new Date()) {
  if (!Array.isArray(seasons) || seasons.length === 0) {
    return null;
  }
  const currentDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const currentTime = currentDate.getTime();
  if (!Number.isFinite(currentTime)) {
    return null;
  }
  for (const season of seasons) {
    if (!season || season.id === undefined || season.id === null) {
      continue;
    }
    const startTime = parseSeasonBoundary(season.dateBegin, false);
    const endTime = parseSeasonBoundary(season.dateEnd, true);
    if (startTime !== null && Number.isFinite(startTime) && currentTime < startTime) {
      continue;
    }
    if (endTime !== null && Number.isFinite(endTime) && currentTime > endTime) {
      continue;
    }
    return String(season.id);
  }
  return null;
}
