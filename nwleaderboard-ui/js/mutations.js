const TYPE_KEYS = [
  'mutationTypeId',
  'mutation_type_id',
  'mutationType',
  'mutation_type',
];

const TYPE_GENERIC_KEYS = ['typeId', 'type_id', 'type'];

const PROMOTION_KEYS = [
  'mutationPromotionId',
  'mutation_promotion_id',
  'mutationPromotion',
  'mutation_promotion',
];

const PROMOTION_GENERIC_KEYS = ['promotionId', 'promotion_id', 'promotion'];

const CURSE_KEYS = [
  'mutationCurseId',
  'mutation_curse_id',
  'mutationCurse',
  'mutation_curse',
];

const CURSE_GENERIC_KEYS = ['curseId', 'curse_id', 'curse'];

const NESTED_KEYS = ['mutation', 'mutations', 'mutationInfo', 'mutation_ids', 'mutationIds'];

function normaliseId(value) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object' && 'id' in value) {
    return normaliseId(value.id);
  }
  return String(value).trim();
}

function gatherContainers(source) {
  if (!source || typeof source !== 'object') {
    return [];
  }
  const containers = [{ data: source, allowGeneric: false }];
  NESTED_KEYS.forEach((key) => {
    const nested = source[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      containers.push({ data: nested, allowGeneric: true });
    }
  });
  return containers;
}

function readKey(container, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(container, key)) {
      const normalised = normaliseId(container[key]);
      if (normalised) {
        return normalised;
      }
    }
  }
  return null;
}

export function extractMutationIds(...sources) {
  const result = {
    typeId: null,
    promotionId: null,
    curseId: null,
  };

  const queue = [];
  sources.forEach((source) => {
    if (Array.isArray(source)) {
      source.forEach((item) => queue.push(item));
    } else if (source) {
      queue.push(source);
    }
  });

  queue.forEach((item) => {
    gatherContainers(item).forEach(({ data, allowGeneric }) => {
      if (!result.typeId) {
        const keys = allowGeneric ? TYPE_KEYS.concat(TYPE_GENERIC_KEYS) : TYPE_KEYS;
        result.typeId = readKey(data, keys);
      }
      if (!result.promotionId) {
        const keys = allowGeneric ? PROMOTION_KEYS.concat(PROMOTION_GENERIC_KEYS) : PROMOTION_KEYS;
        result.promotionId = readKey(data, keys);
      }
      if (!result.curseId) {
        const keys = allowGeneric ? CURSE_KEYS.concat(CURSE_GENERIC_KEYS) : CURSE_KEYS;
        result.curseId = readKey(data, keys);
      }
    });
  });

  return result;
}

export function hasMutationIds(mutations) {
  if (!mutations) {
    return false;
  }
  const { typeId, promotionId, curseId } = mutations;
  return Boolean(
    (typeof typeId === 'string' && typeId.trim()) ||
      (typeof promotionId === 'string' && promotionId.trim()) ||
      (typeof curseId === 'string' && curseId.trim()),
  );
}

export function getMutationIconSources({ typeId, promotionId, curseId }) {
  const icons = [];
  if (typeId) {
    icons.push({ kind: 'type', id: typeId, src: `images/icons/mutations/type/${encodeURIComponent(typeId)}.png` });
  }
  if (promotionId) {
    icons.push({
      kind: 'promotion',
      id: promotionId,
      src: `images/icons/mutations/promotion/${encodeURIComponent(promotionId)}.png`,
    });
  }
  if (curseId) {
    icons.push({ kind: 'curse', id: curseId, src: `images/icons/mutations/curse/${encodeURIComponent(curseId)}.png` });
  }
  return icons;
}
