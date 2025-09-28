import { LangContext } from '../i18n.js';
import { getDungeonNameForLang, toLocaleCode } from '../dungeons.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

const FIELD_CONFIG = {
  seasonId: {
    optionKey: 'seasons',
    requestKey: 'season_id',
    valueType: 'number',
  },
  mutationElementId: {
    optionKey: 'elements',
    requestKey: 'mutation_element_id',
  },
  mutationTypeId: {
    optionKey: 'types',
    requestKey: 'mutation_type_id',
  },
  mutationPromotionId: {
    optionKey: 'promotions',
    requestKey: 'mutation_promotion_id',
  },
  mutationCurseId: {
    optionKey: 'curses',
    requestKey: 'mutation_curse_id',
  },
};

function createEmptyOptions() {
  return {
    dungeons: [],
    elements: [],
    types: [],
    promotions: [],
    curses: [],
    seasons: [],
  };
}

function normaliseNames(names) {
  if (!names || typeof names !== 'object') {
    return {};
  }
  const result = {};
  Object.entries(names).forEach(([key, value]) => {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    result[key] = trimmed;
  });
  return result;
}

function normaliseEntry(entry, index = 0) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const weekValue = Number.parseInt(entry.week, 10);
  const week = Number.isFinite(weekValue) ? weekValue : null;
  const dungeonIdValue = Number(entry.dungeon_id ?? entry.dungeonId);
  const dungeonId = Number.isFinite(dungeonIdValue) ? dungeonIdValue : null;
  const dungeonNames = normaliseNames(entry.dungeon_names ?? entry.dungeonNames);
  const seasonValue = Number(entry.season_id ?? entry.seasonId);
  const seasonId = Number.isFinite(seasonValue) ? seasonValue : null;
  const element = typeof entry.mutation_element_id === 'string' ? entry.mutation_element_id.trim() : '';
  const type = typeof entry.mutation_type_id === 'string' ? entry.mutation_type_id.trim() : '';
  const promotion =
    typeof entry.mutation_promotion_id === 'string' ? entry.mutation_promotion_id.trim() : '';
  const curse = typeof entry.mutation_curse_id === 'string' ? entry.mutation_curse_id.trim() : '';
  const key = dungeonId !== null && week !== null ? `${week}-${dungeonId}` : `row-${index}`;
  return {
    key,
    week,
    dungeonId,
    dungeonNames,
    seasonId,
    mutationElementId: element,
    mutationTypeId: type,
    mutationPromotionId: promotion,
    mutationCurseId: curse,
  };
}

function normaliseDungeonOption(option) {
  if (!option || typeof option !== 'object') {
    return null;
  }
  const dungeonIdValue = Number(option.id ?? option.dungeon_id ?? option.dungeonId);
  const dungeonId = Number.isFinite(dungeonIdValue) ? dungeonIdValue : null;
  if (dungeonId === null) {
    return null;
  }
  return {
    id: dungeonId,
    names: normaliseNames(option.names ?? option.dungeon_names ?? {}),
  };
}

function normaliseOptionList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  list.forEach((value) => {
    const text = typeof value === 'string' ? value.trim() : value !== undefined && value !== null ? String(value).trim() : '';
    if (!text || seen.has(text)) {
      return;
    }
    seen.add(text);
    result.push(text);
  });
  result.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return result;
}

function formatSeasonLabel(dateBegin, dateEnd) {
  const begin = typeof dateBegin === 'string' ? dateBegin.trim() : '';
  const end = typeof dateEnd === 'string' ? dateEnd.trim() : '';
  if (begin && end) {
    return `${begin} → ${end}`;
  }
  if (begin) {
    return begin;
  }
  if (end) {
    return end;
  }
  return '';
}

function normaliseSeasonOption(option) {
  if (!option || typeof option !== 'object') {
    return null;
  }
  const idValue = Number(option.id ?? option.season_id ?? option.seasonId);
  const id = Number.isFinite(idValue) ? idValue : null;
  if (id === null) {
    return null;
  }
  const dateBegin =
    typeof option.date_begin === 'string'
      ? option.date_begin.trim()
      : typeof option.dateBegin === 'string'
        ? option.dateBegin.trim()
        : '';
  const dateEnd =
    typeof option.date_end === 'string'
      ? option.date_end.trim()
      : typeof option.dateEnd === 'string'
        ? option.dateEnd.trim()
        : '';
  const label = formatSeasonLabel(dateBegin, dateEnd) || String(id);
  return {
    id,
    dateBegin,
    dateEnd,
    label,
  };
}

function getSeasonLabelById(list, seasonId) {
  const numericId = Number(seasonId);
  if (!Number.isFinite(numericId)) {
    return '';
  }
  const match = Array.isArray(list)
    ? list.find((item) => Number.isFinite(item?.id) && Number(item.id) === numericId)
    : null;
  return match ? match.label || String(match.id) : '';
}

function sortSeasonOptions(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return [...list].sort((left, right) => {
    const leftDate = left?.dateBegin || '';
    const rightDate = right?.dateBegin || '';
    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate);
    }
    return (right?.id ?? 0) - (left?.id ?? 0);
  });
}

function createCollator(lang) {
  try {
    return new Intl.Collator(toLocaleCode(lang), { sensitivity: 'base', usage: 'sort' });
  } catch (error) {
    return new Intl.Collator('en', { sensitivity: 'base', usage: 'sort' });
  }
}

function getEntryDungeonName(entry, lang) {
  if (!entry) {
    return '';
  }
  const names = entry.dungeonNames || {};
  const fallback = names.en || '';
  return getDungeonNameForLang({ id: entry.dungeonId, names, fallbackName: fallback }, lang);
}

function getDungeonOptionLabel(option, lang) {
  if (!option) {
    return '';
  }
  const names = option.names || {};
  const fallback = names.en || '';
  return getDungeonNameForLang({ id: option.id, names, fallbackName: fallback }, lang);
}

function sortEntries(list, lang) {
  if (!Array.isArray(list)) {
    return [];
  }
  const collator = createCollator(lang);
  return [...list].sort((left, right) => {
    const leftWeek = Number.isFinite(left?.week) ? left.week : Number.NEGATIVE_INFINITY;
    const rightWeek = Number.isFinite(right?.week) ? right.week : Number.NEGATIVE_INFINITY;
    if (leftWeek !== rightWeek) {
      return rightWeek - leftWeek;
    }
    const leftName = getEntryDungeonName(left, lang);
    const rightName = getEntryDungeonName(right, lang);
    return collator.compare(rightName, leftName);
  });
}

function sortDungeonOptions(list, lang) {
  if (!Array.isArray(list)) {
    return [];
  }
  const collator = createCollator(lang);
  return [...list].sort((left, right) => {
    const leftName = getDungeonOptionLabel(left, lang);
    const rightName = getDungeonOptionLabel(right, lang);
    return collator.compare(leftName, rightName);
  });
}

function normaliseOptions(payload) {
  if (!payload || typeof payload !== 'object') {
    return createEmptyOptions();
  }
  const dungeons = Array.isArray(payload.dungeons)
    ? payload.dungeons.map((option) => normaliseDungeonOption(option)).filter(Boolean)
    : [];
  const seasons = Array.isArray(payload.seasons)
    ? payload.seasons.map((option) => normaliseSeasonOption(option)).filter(Boolean)
    : [];
  const uniqueSeasons = [];
  const seenSeasonIds = new Set();
  seasons.forEach((season) => {
    if (!season || season.id === null || seenSeasonIds.has(season.id)) {
      return;
    }
    seenSeasonIds.add(season.id);
    uniqueSeasons.push(season);
  });
  return {
    dungeons,
    elements: normaliseOptionList(payload.elements),
    types: normaliseOptionList(payload.types),
    promotions: normaliseOptionList(payload.promotions),
    curses: normaliseOptionList(payload.curses),
    seasons: uniqueSeasons,
  };
}

export default function ContributeMutations() {
  const { t, lang } = React.useContext(LangContext);
  const [entries, setEntries] = React.useState([]);
  const [options, setOptions] = React.useState(() => createEmptyOptions());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [feedback, setFeedback] = React.useState({ type: '', text: '' });
  const [activeEdit, setActiveEdit] = React.useState(null);
  const [pendingKeys, setPendingKeys] = React.useState([]);
  const [newRow, setNewRow] = React.useState(null);
  const [creatingPending, setCreatingPending] = React.useState(false);
  const editSelectRef = React.useRef(null);
  const newWeekRef = React.useRef(null);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setFeedback({ type: '', text: '' });

    Promise.all([
      fetch(`${API_BASE_URL}/contributor/mutations`, { signal: controller.signal }),
      fetch(`${API_BASE_URL}/contributor/mutations/options`, { signal: controller.signal }),
    ])
      .then(async ([entriesResponse, optionsResponse]) => {
        if (!entriesResponse.ok) {
          const data = await entriesResponse.json().catch(() => null);
          const message = data && typeof data.message === 'string' ? data.message : '';
          throw new Error(message || `Failed to load weekly mutations: ${entriesResponse.status}`);
        }
        if (!optionsResponse.ok) {
          const data = await optionsResponse.json().catch(() => null);
          const message = data && typeof data.message === 'string' ? data.message : '';
          throw new Error(message || `Failed to load mutation options: ${optionsResponse.status}`);
        }
        const [entriesData, optionsData] = await Promise.all([
          entriesResponse.json().catch(() => []),
          optionsResponse.json().catch(() => ({})),
        ]);
        if (!active) {
          return;
        }
        const normalisedEntries = Array.isArray(entriesData)
          ? entriesData.map((item, index) => normaliseEntry(item, index)).filter(Boolean)
          : [];
        setEntries(normalisedEntries);
        setOptions(normaliseOptions(optionsData));
      })
      .catch((fetchError) => {
        if (!active || fetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load mutation configuration', fetchError);
        setEntries([]);
        setOptions(createEmptyOptions());
        setError(fetchError && fetchError.message ? fetchError.message : t.contributeMutationsError);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [t]);

  React.useEffect(() => {
    if (activeEdit && editSelectRef.current) {
      editSelectRef.current.focus();
    }
  }, [activeEdit]);

  React.useEffect(() => {
    if (newRow && newWeekRef.current) {
      newWeekRef.current.focus();
    }
  }, [newRow]);

  const sortedEntries = React.useMemo(() => sortEntries(entries, lang), [entries, lang]);
  const sortedDungeonOptions = React.useMemo(
    () => sortDungeonOptions(options.dungeons, lang),
    [options.dungeons, lang],
  );
  const sortedSeasonOptions = React.useMemo(
    () => sortSeasonOptions(options.seasons),
    [options.seasons],
  );

  const handleStartEdit = React.useCallback(
    (entry, field) => {
      if (!entry || !FIELD_CONFIG[field]) {
        return;
      }
      if (pendingKeys.includes(entry.key) || creatingPending) {
        return;
      }
      setActiveEdit({
        key: entry.key,
        field,
        week: entry.week,
        dungeonId: entry.dungeonId,
        originalValue:
          entry[field] === undefined || entry[field] === null ? '' : String(entry[field]),
        value: entry[field] === undefined || entry[field] === null ? '' : String(entry[field]),
      });
      setFeedback({ type: '', text: '' });
    },
    [pendingKeys, creatingPending],
  );

  const handleEditValueChange = React.useCallback((event) => {
    const { value } = event.target;
    setActiveEdit((current) => (current ? { ...current, value } : current));
  }, []);

  const addPendingKey = React.useCallback((key) => {
    setPendingKeys((current) => (current.includes(key) ? current : [...current, key]));
  }, []);

  const removePendingKey = React.useCallback((key) => {
    setPendingKeys((current) => current.filter((item) => item !== key));
  }, []);

  const updateEntryList = React.useCallback((updatedEntry, propagateSeason = false) => {
    if (!updatedEntry) {
      return;
    }
    setEntries((current) => {
      let found = false;
      const updatedWeek = Number.isFinite(updatedEntry.week) ? updatedEntry.week : null;
      const updatedSeasonId = Number.isFinite(updatedEntry.seasonId)
        ? updatedEntry.seasonId
        : null;
      const mapped = current.map((item) => {
        if (!item) {
          return item;
        }
        if (item.key === updatedEntry.key) {
          found = true;
          return updatedEntry;
        }
        if (
          propagateSeason &&
          updatedSeasonId !== null &&
          updatedWeek !== null &&
          Number.isFinite(item.week) &&
          item.week <= updatedWeek &&
          (item.seasonId === null || item.seasonId === undefined)
        ) {
          return { ...item, seasonId: updatedSeasonId };
        }
        return item;
      });
      if (!found) {
        mapped.push(updatedEntry);
      }
      return mapped;
    });
  }, []);

  const handleConfirmEdit = React.useCallback(() => {
    if (!activeEdit) {
      return;
    }
    const config = FIELD_CONFIG[activeEdit.field];
    if (!config) {
      return;
    }
    const rawValue = typeof activeEdit.value === 'string' ? activeEdit.value.trim() : '';
    const originalValue = activeEdit.originalValue ?? '';
    let payloadValue;
    if (config.valueType === 'number') {
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        setFeedback({ type: 'error', text: t.contributeMutationsSeasonRequired });
        return;
      }
      if (String(numericValue) === originalValue) {
        setActiveEdit(null);
        return;
      }
      payloadValue = numericValue;
    } else {
      if (!rawValue || rawValue === originalValue) {
        setActiveEdit(null);
        return;
      }
      payloadValue = rawValue;
    }
    const payload = { [config.requestKey]: payloadValue };
    const rowKey = activeEdit.key;
    const shouldPropagateSeason = config.optionKey === 'seasons';
    addPendingKey(rowKey);
    setFeedback({ type: '', text: '' });

    fetch(`${API_BASE_URL}/contributor/mutations/${activeEdit.week}/${activeEdit.dungeonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .catch(() => null)
            .then((data) => {
              const message = data && typeof data.message === 'string' ? data.message : '';
              throw new Error(message || `Failed to update mutation: ${response.status}`);
            });
        }
        return response.json().catch(() => null);
      })
      .then((data) => {
        const updated = normaliseEntry(data || {}, entries.length);
        if (updated) {
          updateEntryList(updated, shouldPropagateSeason);
          setFeedback({ type: 'success', text: t.contributeMutationsUpdateSuccess });
        }
        setActiveEdit(null);
      })
      .catch((errorResponse) => {
        console.error('Unable to update mutation', errorResponse);
        setFeedback({
          type: 'error',
          text:
            errorResponse && errorResponse.message
              ? errorResponse.message
              : t.contributeMutationsUpdateError,
        });
      })
      .finally(() => {
        removePendingKey(rowKey);
      });
  }, [activeEdit, addPendingKey, entries.length, removePendingKey, t, updateEntryList]);

  const handleCancelEdit = React.useCallback(() => {
    setActiveEdit(null);
  }, []);

  const handleEditKeyDown = React.useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleConfirmEdit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelEdit();
      }
    },
    [handleConfirmEdit, handleCancelEdit],
  );

  const handleAddRowClick = React.useCallback(() => {
    if (creatingPending) {
      return;
    }
    setActiveEdit(null);
    setFeedback({ type: '', text: '' });
    const defaultSeasonId =
      sortedSeasonOptions.length > 0 ? String(sortedSeasonOptions[0].id) : '';
    setNewRow({
      week: '',
      dungeonId: '',
      seasonId: defaultSeasonId,
      mutationElementId: '',
      mutationTypeId: '',
      mutationPromotionId: '',
      mutationCurseId: '',
    });
  }, [creatingPending, sortedSeasonOptions]);

  const handleNewRowChange = React.useCallback((field, value) => {
    setNewRow((current) => (current ? { ...current, [field]: value } : current));
  }, []);

  const handleCancelNewRow = React.useCallback(() => {
    setNewRow(null);
  }, []);

  const handleCreateNewRow = React.useCallback(() => {
    if (!newRow || creatingPending) {
      return;
    }
    const weekValue = Number.parseInt(newRow.week, 10);
    const dungeonIdValue = Number(newRow.dungeonId);
    const seasonIdValue = Number(newRow.seasonId);
    const element = (newRow.mutationElementId || '').trim();
    const type = (newRow.mutationTypeId || '').trim();
    const promotion = (newRow.mutationPromotionId || '').trim();
    const curse = (newRow.mutationCurseId || '').trim();
    if (!Number.isFinite(weekValue) || weekValue <= 0) {
      setFeedback({ type: 'error', text: t.contributeMutationsWeekRequired });
      return;
    }
    if (!Number.isFinite(dungeonIdValue) || dungeonIdValue <= 0) {
      setFeedback({ type: 'error', text: t.contributeMutationsDungeonRequired });
      return;
    }
    if (!Number.isFinite(seasonIdValue) || seasonIdValue <= 0) {
      setFeedback({ type: 'error', text: t.contributeMutationsSeasonRequired });
      return;
    }
    if (!element || !type || !promotion || !curse) {
      setFeedback({ type: 'error', text: t.contributeMutationsSelectionRequired });
      return;
    }
    const duplicate = entries.some(
      (entry) => entry && entry.week === weekValue && entry.dungeonId === dungeonIdValue,
    );
    if (duplicate) {
      setFeedback({ type: 'error', text: t.contributeMutationsDuplicateError });
      return;
    }
    setFeedback({ type: '', text: '' });
    setCreatingPending(true);

    fetch(`${API_BASE_URL}/contributor/mutations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week: weekValue,
        dungeon_id: dungeonIdValue,
        season_id: seasonIdValue,
        mutation_element_id: element,
        mutation_type_id: type,
        mutation_promotion_id: promotion,
        mutation_curse_id: curse,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .catch(() => null)
            .then((data) => {
              const message = data && typeof data.message === 'string' ? data.message : '';
              throw new Error(message || `Failed to create mutation: ${response.status}`);
            });
        }
        return response.json().catch(() => null);
      })
      .then((data) => {
        const created = normaliseEntry(data || {}, entries.length);
        if (created) {
          updateEntryList(created);
          setFeedback({ type: 'success', text: t.contributeMutationsCreateSuccess });
        }
        setNewRow(null);
      })
      .catch((creationError) => {
        console.error('Unable to create mutation', creationError);
        setFeedback({
          type: 'error',
          text:
            creationError && creationError.message
              ? creationError.message
              : t.contributeMutationsCreateError,
        });
      })
      .finally(() => {
        setCreatingPending(false);
      });
  }, [creatingPending, entries, newRow, t, updateEntryList]);

  const handleDeleteEntry = React.useCallback(
    (entry) => {
      if (!entry || pendingKeys.includes(entry.key) || creatingPending) {
        return;
      }
      const rowKey = entry.key;
      addPendingKey(rowKey);
      setFeedback({ type: '', text: '' });

      fetch(`${API_BASE_URL}/contributor/mutations/${entry.week}/${entry.dungeonId}`, {
        method: 'DELETE',
      })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .catch(() => null)
              .then((data) => {
                const message = data && typeof data.message === 'string' ? data.message : '';
                throw new Error(message || `Failed to delete mutation: ${response.status}`);
              });
          }
          return null;
        })
        .then(() => {
          setEntries((current) => current.filter((item) => item && item.key !== rowKey));
          setFeedback({ type: 'success', text: t.contributeMutationsDeleteSuccess });
        })
        .catch((deletionError) => {
          console.error('Unable to delete mutation', deletionError);
          setFeedback({
            type: 'error',
            text:
              deletionError && deletionError.message
                ? deletionError.message
                : t.contributeMutationsDeleteError,
          });
        })
        .finally(() => {
          removePendingKey(rowKey);
        });
    },
    [addPendingKey, creatingPending, pendingKeys, removePendingKey, t],
  );

  const renderValueCell = (entry, field, label) => {
    const config = FIELD_CONFIG[field];
    const isEditing = activeEdit && activeEdit.key === entry.key && activeEdit.field === field;
    const pending = pendingKeys.includes(entry.key);
    const isSeasonField = config?.optionKey === 'seasons';
    const optionsList = config
      ? config.optionKey === 'seasons'
        ? sortedSeasonOptions
        : options[config.optionKey] || []
      : [];
    const rawValue = entry[field];
    const value = rawValue === undefined || rawValue === null ? '' : rawValue;
    const displayValue = isSeasonField ? getSeasonLabelById(optionsList, value) : value || label;

    return (
      <td
        key={field}
        className={`contribute-mutations-cell contribute-mutations-cell--editable${
          isEditing ? ' is-editing' : ''
        }${pending ? ' is-pending' : ''}`}
        onDoubleClick={() => handleStartEdit(entry, field)}
      >
        {isEditing ? (
          <select
            ref={editSelectRef}
            value={activeEdit?.value ?? ''}
            onChange={handleEditValueChange}
            onKeyDown={handleEditKeyDown}
            disabled={pending}
          >
            {isSeasonField ? (
              <>
                <option value="">{t.contributeMutationsSelectOption}</option>
                {optionsList.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.label}
                  </option>
                ))}
              </>
            ) : (
              optionsList.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))
            )}
          </select>
        ) : (
          <span>{displayValue || label}</span>
        )}
      </td>
    );
  };

  return (
    <section className="contribute-mutations">
      <div className="contribute-mutations-toolbar">
        <p className="page-description">{t.contributeMutationsDescription}</p>
        <div className="contribute-mutations-toolbar-actions">
          <button
            type="button"
            onClick={handleAddRowClick}
            disabled={
              creatingPending ||
              loading ||
              !!newRow ||
              sortedDungeonOptions.length === 0 ||
              sortedSeasonOptions.length === 0 ||
              options.elements.length === 0 ||
              options.types.length === 0 ||
              options.promotions.length === 0 ||
              options.curses.length === 0
            }
          >
            {t.contributeMutationsAddRow}
          </button>
        </div>
      </div>
      <div className="contribute-mutations-table-container" aria-live="polite">
        {loading ? <p className="form-hint">{t.contributeMutationsLoading}</p> : null}
        {error ? (
          <p className="form-message error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error ? (
          <table className="contribute-mutations-table">
            <thead>
              <tr>
                <th scope="col">{t.contributeMutationsSeason}</th>
                <th scope="col">{t.contributeMutationsWeek}</th>
                <th scope="col">{t.contributeMutationsDungeon}</th>
                <th scope="col">{t.contributeMutationsElement}</th>
                <th scope="col">{t.contributeMutationsType}</th>
                <th scope="col">{t.contributeMutationsPromotion}</th>
                <th scope="col">{t.contributeMutationsCurse}</th>
                <th scope="col">{t.contributeMutationsActions}</th>
              </tr>
            </thead>
            <tbody>
              {newRow ? (
                <tr className="contribute-mutations-row is-new">
                  <td>
                    <select
                      value={newRow.seasonId}
                      onChange={(event) => handleNewRowChange('seasonId', event.target.value)}
                    >
                      <option value="">{t.contributeMutationsSelectOption}</option>
                      {sortedSeasonOptions.map((option) => (
                        <option key={option.id} value={String(option.id)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <th scope="row">
                    <input
                      ref={newWeekRef}
                      type="number"
                      min="1"
                      value={newRow.week}
                      onChange={(event) => handleNewRowChange('week', event.target.value)}
                    />
                  </th>
                  <td>
                    <select
                      value={newRow.dungeonId}
                      onChange={(event) => handleNewRowChange('dungeonId', event.target.value)}
                    >
                      <option value="">{t.contributeMutationsSelectOption}</option>
                      {sortedDungeonOptions.map((option) => (
                        <option key={option.id} value={String(option.id)}>
                          {getDungeonOptionLabel(option, lang)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={newRow.mutationElementId}
                      onChange={(event) => handleNewRowChange('mutationElementId', event.target.value)}
                    >
                      <option value="">{t.contributeMutationsSelectOption}</option>
                      {options.elements.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={newRow.mutationTypeId}
                      onChange={(event) => handleNewRowChange('mutationTypeId', event.target.value)}
                    >
                      <option value="">{t.contributeMutationsSelectOption}</option>
                      {options.types.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={newRow.mutationPromotionId}
                      onChange={(event) => handleNewRowChange('mutationPromotionId', event.target.value)}
                    >
                      <option value="">{t.contributeMutationsSelectOption}</option>
                      {options.promotions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={newRow.mutationCurseId}
                      onChange={(event) => handleNewRowChange('mutationCurseId', event.target.value)}
                    >
                      <option value="">{t.contributeMutationsSelectOption}</option>
                      {options.curses.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="contribute-mutations-actions">
                    <button
                      type="button"
                      onClick={handleCreateNewRow}
                      disabled={creatingPending}
                    >
                      {t.contributeMutationsCreate}
                    </button>
                    <button type="button" className="secondary" onClick={handleCancelNewRow}>
                      {t.contributeMutationsCancel}
                    </button>
                  </td>
                </tr>
              ) : null}
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="contribute-mutations-empty">
                    {t.contributeMutationsEmpty}
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  const rowPending = pendingKeys.includes(entry.key);
                  const dungeonName = getEntryDungeonName(entry, lang);
                  const isEditing = activeEdit && activeEdit.key === entry.key;
                  const activeConfig = isEditing ? FIELD_CONFIG[activeEdit.field] : null;
                  const trimmedActiveValue =
                    typeof activeEdit?.value === 'string' ? activeEdit.value.trim() : '';
                  const confirmDisabled = !isEditing
                    || rowPending
                    || (activeConfig?.valueType === 'number'
                      ? !trimmedActiveValue
                        || !Number.isFinite(Number(trimmedActiveValue))
                        || Number(trimmedActiveValue) <= 0
                        || String(Number(trimmedActiveValue)) === (activeEdit?.originalValue ?? '')
                      : !trimmedActiveValue
                        || trimmedActiveValue === (activeEdit?.originalValue ?? ''));
                  return (
                    <tr
                      key={entry.key}
                      className={`contribute-mutations-row${isEditing ? ' is-editing' : ''}${
                        rowPending ? ' is-pending' : ''
                      }`}
                    >
                      {renderValueCell(entry, 'seasonId', t.contributeMutationsUnknownValue)}
                      <th scope="row">{entry.week}</th>
                      <td>{dungeonName}</td>
                      {renderValueCell(entry, 'mutationElementId', t.contributeMutationsUnknownValue)}
                      {renderValueCell(entry, 'mutationTypeId', t.contributeMutationsUnknownValue)}
                      {renderValueCell(entry, 'mutationPromotionId', t.contributeMutationsUnknownValue)}
                      {renderValueCell(entry, 'mutationCurseId', t.contributeMutationsUnknownValue)}
                      <td className="contribute-mutations-actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={handleConfirmEdit}
                              disabled={confirmDisabled}
                            >
                              {t.contributeMutationsConfirm}
                            </button>
                            <button type="button" className="secondary" onClick={handleCancelEdit}>
                              {t.contributeMutationsCancel}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="danger"
                            onClick={() => handleDeleteEntry(entry)}
                            disabled={rowPending}
                          >
                            {t.contributeMutationsDelete}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : null}
      </div>
      {feedback.text ? (
        <p
          className={`form-message${feedback.type === 'error' ? ' error' : ''}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      ) : null}
    </section>
  );
}
