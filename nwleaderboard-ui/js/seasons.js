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

