const FALLBACK_REGIONS = ['EUC', 'USE', 'USW', 'SAE', 'APS'];

export const DEFAULT_REGIONS = [...FALLBACK_REGIONS];

export function normaliseRegionList(rawRegions, fallback = DEFAULT_REGIONS) {
  const seen = new Set();
  const result = [];
  if (Array.isArray(rawRegions)) {
    for (const entry of rawRegions) {
      let identifier = null;
      if (entry && typeof entry === 'object') {
        if (typeof entry.id === 'string') {
          identifier = entry.id;
        } else if (typeof entry.region === 'string') {
          identifier = entry.region;
        } else if (typeof entry.code === 'string') {
          identifier = entry.code;
        }
      } else if (typeof entry === 'string') {
        identifier = entry;
      }
      if (typeof identifier !== 'string') {
        continue;
      }
      const normalised = identifier.trim().toUpperCase();
      if (!normalised || seen.has(normalised)) {
        continue;
      }
      seen.add(normalised);
      result.push(normalised);
    }
  }
  if (Array.isArray(fallback)) {
    for (const candidate of fallback) {
      if (typeof candidate !== 'string') {
        continue;
      }
      const normalised = candidate.trim().toUpperCase();
      if (!normalised || seen.has(normalised)) {
        continue;
      }
      seen.add(normalised);
      result.push(normalised);
    }
  }
  return result;
}

export function translateRegion(t, regionId) {
  if (!regionId) {
    return '';
  }
  const key = `region${regionId}`;
  const value = t && t[key];
  if (typeof value === 'function') {
    try {
      const resolved = value(regionId);
      if (resolved) {
        return resolved;
      }
    } catch (error) {
      // ignore translation errors and fall back to the identifier
    }
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return regionId;
}
