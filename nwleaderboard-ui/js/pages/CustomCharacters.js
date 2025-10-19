import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function toNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function CustomCharacters() {
  const { t } = React.useContext(LangContext);
  const [characters, setCharacters] = React.useState([]);
  const [availableWeeks, setAvailableWeeks] = React.useState([]);
  const [selectedWeek, setSelectedWeek] = React.useState(null);
  const [currentWeek, setCurrentWeek] = React.useState(null);
  const [includeDeleted, setIncludeDeleted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [newCharacterName, setNewCharacterName] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [refreshIndex, setRefreshIndex] = React.useState(0);
  const [editingCell, setEditingCell] = React.useState(null);
  const [editingValue, setEditingValue] = React.useState('');
  const [savingCell, setSavingCell] = React.useState(false);
  const inputRef = React.useRef(null);

  const triggerRefresh = React.useCallback(() => {
    setRefreshIndex((value) => value + 1);
  }, []);

  React.useEffect(() => {
    if (!API_BASE_URL) {
      setError('Missing API configuration.');
      return () => {};
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (selectedWeek !== null && selectedWeek !== undefined && selectedWeek !== '') {
      params.set('week', selectedWeek);
    }
    if (includeDeleted) {
      params.set('includeDeleted', 'true');
    }

    const url = `${API_BASE_URL}/custom-characters${
      params.toString() ? `?${params.toString()}` : ''
    }`;

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load');
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        const weeks = Array.isArray(data?.availableWeeks) ? data.availableWeeks : [];
        setAvailableWeeks(weeks);
        setCurrentWeek(data?.currentWeek ?? null);
        setCharacters(Array.isArray(data?.characters) ? data.characters : []);
        if (selectedWeek === null && data?.selectedWeek !== undefined && data?.selectedWeek !== null) {
          setSelectedWeek(data.selectedWeek);
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setError(t.customCharactersLoadError || 'Unable to load characters.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [API_BASE_URL, includeDeleted, selectedWeek, refreshIndex, t]);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (typeof inputRef.current.select === 'function') {
        inputRef.current.select();
      }
    }
  }, [editingCell]);

  const handleAddCharacter = React.useCallback(
    async (event) => {
      event.preventDefault();
      const trimmed = newCharacterName.trim();
      if (!trimmed || !API_BASE_URL) {
        return;
      }
      setAdding(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/custom-characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!response.ok) {
          throw new Error('Failed to add');
        }
        setNewCharacterName('');
        triggerRefresh();
      } catch (addError) {
        console.error(addError);
        setError(t.customCharactersAddError || 'Unable to add character.');
      } finally {
        setAdding(false);
      }
    },
    [newCharacterName, triggerRefresh, t],
  );

  const stopEditing = React.useCallback(() => {
    setEditingCell(null);
    setEditingValue('');
  }, []);

  const handleDoubleClick = (character, field) => {
    if (savingCell) {
      return;
    }
    if (character?.deleted && field !== 'name') {
      return;
    }
    if (field !== 'name' && selectedWeek === null) {
      return;
    }
    const currentValue =
      field === 'name'
        ? character?.name ?? ''
        : field === 'umbrals'
        ? character?.weekUmbralsCap ?? 0
        : field === 'winter'
        ? character?.weekWinterLimit ?? 0
        : character?.weekHatcheryLimit ?? 0;
    setEditingCell({ id: character.id, field });
    setEditingValue(String(currentValue ?? ''));
  };

  const commitEdit = React.useCallback(async () => {
    if (!editingCell || !API_BASE_URL) {
      return;
    }
    const { id, field } = editingCell;
    const character = characters.find((entry) => entry.id === id);
    if (!character) {
      stopEditing();
      return;
    }
    setSavingCell(true);
    setError(null);

    try {
      if (field === 'name') {
        const trimmed = editingValue.trim();
        if (!trimmed) {
          throw new Error('Invalid');
        }
        const response = await fetch(`${API_BASE_URL}/custom-characters/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!response.ok) {
          throw new Error('Failed');
        }
      } else {
        const effectiveWeek = selectedWeek ?? currentWeek;
        if (effectiveWeek === null) {
          throw new Error('Missing week');
        }
        const numericValue = toNumber(editingValue);
        if (numericValue === null) {
          throw new Error('Invalid');
        }
        const payload = {
          weekUmbralsCap:
            field === 'umbrals' ? numericValue : character.weekUmbralsCap ?? 0,
          weekWinterLimit:
            field === 'winter' ? numericValue : character.weekWinterLimit ?? 0,
          weekHatcheryLimit:
            field === 'hatchery' ? numericValue : character.weekHatcheryLimit ?? 0,
        };
        const response = await fetch(
          `${API_BASE_URL}/custom-characters/${encodeURIComponent(id)}/limits/${encodeURIComponent(
            effectiveWeek,
          )}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error('Failed');
        }
      }
      triggerRefresh();
    } catch (updateError) {
      console.error(updateError);
      setError(t.customCharactersUpdateError || 'Unable to update value.');
    } finally {
      setSavingCell(false);
      stopEditing();
    }
  }, [editingCell, editingValue, characters, selectedWeek, currentWeek, triggerRefresh, t]);

  const handleEditingKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      stopEditing();
    }
  };

  const handleToggleDeleted = React.useCallback(
    async (character, deleted) => {
      if (!API_BASE_URL || !character?.id) {
        return;
      }
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/custom-characters/${encodeURIComponent(character.id)}/deletion`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleted }),
          },
        );
        if (!response.ok) {
          throw new Error('Failed');
        }
        triggerRefresh();
      } catch (toggleError) {
        console.error(toggleError);
        setError(t.customCharactersDeleteError || 'Unable to update character state.');
      }
    },
    [triggerRefresh, t],
  );

  const renderCellContent = (character, field) => {
    const isEditing = editingCell && editingCell.id === character.id && editingCell.field === field;
    if (isEditing) {
      const inputProps =
        field === 'name'
          ? { type: 'text', minLength: 1, maxLength: 255 }
          : field === 'umbrals'
          ? { type: 'number', min: 0, max: 4000, step: 50 }
          : { type: 'number', min: 0, max: 2, step: 1 };
      return (
        <input
          ref={inputRef}
          className="custom-characters-input"
          value={editingValue}
          onChange={(event) => setEditingValue(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleEditingKeyDown}
          disabled={savingCell}
          {...inputProps}
        />
      );
    }

    if (field === 'name') {
      return (
        <div className="custom-character-name-wrapper">
          <span className="custom-character-name" title={character.name}>
            {character.name}
          </span>
          <button
            type="button"
            className="custom-character-delete"
            onClick={(event) => {
              event.stopPropagation();
              handleToggleDeleted(character, !character.deleted);
            }}
          >
            {character.deleted
              ? t.customCharactersRestore || 'Restore'
              : t.customCharactersDelete || 'Delete'}
          </button>
        </div>
      );
    }

    if (field === 'umbrals') {
      return character.weekUmbralsCap ?? 0;
    }
    if (field === 'winter') {
      return character.weekWinterLimit ?? 0;
    }
    return character.weekHatcheryLimit ?? 0;
  };

  const emptyStateLabel = t.customCharactersEmpty || 'No characters yet.';
  const deletedToggleLabel = t.customCharactersDeletedToggle || 'Show deleted characters';
  const weekLabel = t.customCharactersWeekLabel || 'Week';
  const addLabel = t.customCharactersAddButton || 'Add';
  const addPlaceholder = t.customCharactersAddLabel || 'Character name';
  const title = t.customCharactersTitle || 'Custom characters';
  const description =
    t.customCharactersDescription || 'Manage your personal characters and weekly limits.';

  return (
    <div className="page custom-characters-page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </header>
      <section className="custom-characters-controls">
        <form className="custom-characters-add" onSubmit={handleAddCharacter}>
          <label className="form-field custom-characters-field">
            <span>{addPlaceholder}</span>
            <input
              type="text"
              value={newCharacterName}
              onChange={(event) => setNewCharacterName(event.target.value)}
              maxLength={255}
              placeholder={addPlaceholder}
              disabled={adding}
              required
            />
          </label>
          <button type="submit" className="custom-characters-add-button" disabled={adding}>
            {adding ? t.customCharactersAddSaving || 'Adding…' : addLabel}
          </button>
        </form>
        <div className="custom-characters-view-options">
          <label className="form-field custom-characters-field">
            <span>{weekLabel}</span>
            <select
              value={selectedWeek ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '') {
                  setSelectedWeek(null);
                  return;
                }
                const parsed = Number.parseInt(value, 10);
                setSelectedWeek(Number.isNaN(parsed) ? null : parsed);
              }}
              disabled={loading || availableWeeks.length === 0}
            >
              {availableWeeks.length === 0 ? (
                <option value="">—</option>
              ) : null}
              {availableWeeks.map((week) => (
                <option key={week} value={week}>
                  {weekLabel} {week}
                </option>
              ))}
            </select>
          </label>
          <label className="custom-characters-toggle">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(event) => setIncludeDeleted(event.target.checked)}
              disabled={loading}
            />
            <span>{deletedToggleLabel}</span>
          </label>
        </div>
      </section>
      {error ? <p className="page-error">{error}</p> : null}
      <div className="custom-characters-table-wrapper">
        {loading ? (
          <p className="custom-characters-status">{t.loading || 'Loading…'}</p>
        ) : characters.length === 0 ? (
          <p className="custom-characters-status">{emptyStateLabel}</p>
        ) : (
          <table className="custom-characters-table">
            <thead>
              <tr>
                <th>{t.customCharactersName || 'Character'}</th>
                <th>{t.customCharactersUmbrals || 'Umbrals cap'}</th>
                <th>{t.customCharactersWinter || 'Winter forge'}</th>
                <th>{t.customCharactersHatchery || 'Hatchery'}</th>
              </tr>
            </thead>
            <tbody>
              {characters.map((character) => {
                const rowClass = character.deleted ? 'custom-characters-row is-deleted' : 'custom-characters-row';
                return (
                  <tr key={character.id} className={rowClass}>
                    {['name', 'umbrals', 'winter', 'hatchery'].map((field) => (
                      <td
                        key={field}
                        onDoubleClick={() => handleDoubleClick(character, field)}
                        role="gridcell"
                      >
                        {renderCellContent(character, field)}
                        {field === 'name' && character.deleted ? (
                          <span className="custom-character-deleted-badge">
                            {t.customCharactersDeletedLabel || 'Deleted'}
                          </span>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
