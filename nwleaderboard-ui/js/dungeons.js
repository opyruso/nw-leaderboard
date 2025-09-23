export const DUNGEON_LANG_CODES = ['en', 'de', 'fr', 'es', 'esmx', 'it', 'pl', 'pt'];

export function normaliseLanguageKey(key) {
  if (key === undefined || key === null) {
    return null;
  }
  const lower = String(key).toLowerCase();
  if (lower === 'es-mx' || lower === 'es_mx') {
    return 'esmx';
  }
  if (DUNGEON_LANG_CODES.includes(lower)) {
    return lower;
  }
  return null;
}

export function safeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

export function toLocaleCode(lang) {
  return lang === 'esmx' ? 'es-MX' : lang || 'en';
}

export function normaliseDungeonNames(dungeon) {
  const result = {};
  if (!dungeon || typeof dungeon !== 'object') {
    return result;
  }
  const { names } = dungeon;
  if (names && typeof names === 'object') {
    Object.entries(names).forEach(([key, value]) => {
      const normalisedKey = normaliseLanguageKey(key);
      if (!normalisedKey) {
        return;
      }
      const text = safeString(value);
      if (text) {
        result[normalisedKey] = text;
      }
    });
  }
  return result;
}

export function deriveFallbackName(dungeon, names, id) {
  const candidates = [
    names.en,
    safeString(dungeon?.name),
    safeString(dungeon?.label),
    safeString(dungeon?.title),
    safeString(dungeon?.displayName),
    safeString(dungeon?.slug),
    safeString(dungeon?.code),
    safeString(dungeon?.identifier),
  ];
  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }
  return String(id ?? '');
}

export function getDungeonNameForLang(dungeon, lang) {
  if (!dungeon || typeof dungeon !== 'object') {
    return '';
  }
  const { names = {}, fallbackName = '', id = '' } = dungeon;
  const requested = normaliseLanguageKey(lang);
  const priorities = [];
  if (requested) {
    priorities.push(requested);
    if (requested === 'esmx') {
      priorities.push('es');
    }
  }
  if (!priorities.includes('en')) {
    priorities.push('en');
  }
  DUNGEON_LANG_CODES.forEach((code) => {
    if (!priorities.includes(code)) {
      priorities.push(code);
    }
  });
  for (const code of priorities) {
    const value = safeString(names[code]);
    if (value) {
      return value;
    }
  }
  const fallback = safeString(fallbackName);
  if (fallback) {
    return fallback;
  }
  return String(id || '');
}

export function sortDungeons(list, lang) {
  if (!Array.isArray(list)) {
    return [];
  }
  const copy = list.slice();
  let collator;
  try {
    collator = new Intl.Collator(toLocaleCode(lang), { sensitivity: 'base', usage: 'sort' });
  } catch (error) {
    collator = new Intl.Collator('en', { sensitivity: 'base', usage: 'sort' });
  }
  copy.sort((a, b) => {
    const nameA = getDungeonNameForLang(a, lang);
    const nameB = getDungeonNameForLang(b, lang);
    const comparison = collator.compare(nameA, nameB);
    if (comparison !== 0) {
      return comparison;
    }
    const orderA = typeof a.order === 'number' ? a.order : 0;
    const orderB = typeof b.order === 'number' ? b.order : 0;
    return orderA - orderB;
  });
  return copy;
}

export function normaliseDungeons(data) {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((dungeon, index) => {
      if (!dungeon || typeof dungeon !== 'object') {
        return null;
      }
      const identifier =
        dungeon.id ??
        dungeon.slug ??
        dungeon.code ??
        dungeon.key ??
        dungeon.identifier ??
        dungeon.ref ??
        dungeon.name ??
        index;
      if (identifier === undefined || identifier === null) {
        return null;
      }
      const id = String(identifier);
      const names = normaliseDungeonNames(dungeon);
      const fallbackName = deriveFallbackName(dungeon, names, id);
      if (!names.en && fallbackName) {
        names.en = fallbackName;
      }
      const playerCountValue =
        dungeon.player_count ?? dungeon.playerCount ?? dungeon.players ?? dungeon.expectedPlayerCount;
      const parsedPlayerCount = toPositiveInteger(playerCountValue);
      const highlightedValue =
        dungeon.highlighted ??
        dungeon.is_highlighted ??
        dungeon.isHighlighted ??
        dungeon.featured ??
        dungeon.isFeatured;
      const highlighted = parseBoolean(highlightedValue);
      return {
        id,
        names,
        fallbackName,
        order: index,
        highlighted,
        playerCount: parsedPlayerCount,
      };
    })
    .filter(Boolean);
}

export function parseBoolean(value) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  const text = String(value).trim().toLowerCase();
  if (!text) {
    return false;
  }
  return text === 'true' || text === '1' || text === 'yes' || text === 'y';
}

export function toPositiveInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.trunc(numeric);
}

