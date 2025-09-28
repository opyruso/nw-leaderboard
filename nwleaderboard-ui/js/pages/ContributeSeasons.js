import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function normaliseSeasonEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const idValue = Number(entry.id ?? entry.season_id ?? entry.seasonId);
  const id = Number.isFinite(idValue) ? idValue : null;
  if (id === null) {
    return null;
  }
  const dateBegin = typeof entry.date_begin === 'string'
    ? entry.date_begin.trim()
    : typeof entry.dateBegin === 'string'
      ? entry.dateBegin.trim()
      : '';
  const dateEnd = typeof entry.date_end === 'string'
    ? entry.date_end.trim()
    : typeof entry.dateEnd === 'string'
      ? entry.dateEnd.trim()
      : '';
  return { id, dateBegin, dateEnd };
}

function sortSeasons(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return [...list].sort((left, right) => {
    const leftDate = left?.dateBegin || '';
    const rightDate = right?.dateBegin || '';
    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate);
    }
    const leftId = Number.isFinite(left?.id) ? left.id : Number.NEGATIVE_INFINITY;
    const rightId = Number.isFinite(right?.id) ? right.id : Number.NEGATIVE_INFINITY;
    return rightId - leftId;
  });
}

function isValidDate(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }
  const date = new Date(trimmed);
  return Number.isFinite(date.getTime()) && trimmed === date.toISOString().slice(0, 10);
}

export default function ContributeSeasons() {
  const { t } = React.useContext(LangContext);
  const [seasons, setSeasons] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [feedback, setFeedback] = React.useState({ type: '', text: '' });
  const [activeEdit, setActiveEdit] = React.useState(null);
  const [pendingIds, setPendingIds] = React.useState([]);
  const [newRow, setNewRow] = React.useState(null);
  const editInputRef = React.useRef(null);
  const newIdRef = React.useRef(null);
  const newBeginRef = React.useRef(null);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setFeedback({ type: '', text: '' });

    fetch(`${API_BASE_URL}/contributor/seasons`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .catch(() => null)
            .then((data) => {
              const message = data && typeof data.message === 'string' ? data.message : '';
              throw new Error(message || `Failed to load seasons: ${response.status}`);
            });
        }
        return response.json().catch(() => []);
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const list = Array.isArray(data) ? data.map(normaliseSeasonEntry).filter(Boolean) : [];
        setSeasons(sortSeasons(list));
      })
      .catch((fetchError) => {
        if (!active || fetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load seasons', fetchError);
        setSeasons([]);
        setError(fetchError && fetchError.message ? fetchError.message : t.contributeSeasonsError);
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
    if (activeEdit && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [activeEdit]);

  React.useEffect(() => {
    if (newRow) {
      if (newIdRef.current) {
        newIdRef.current.focus();
      } else if (newBeginRef.current) {
        newBeginRef.current.focus();
      }
    }
  }, [newRow]);

  const sortedSeasons = React.useMemo(() => sortSeasons(seasons), [seasons]);

  const addPendingId = React.useCallback((id) => {
    setPendingIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const removePendingId = React.useCallback((id) => {
    setPendingIds((current) => current.filter((value) => value !== id));
  }, []);

  const handleStartEdit = React.useCallback(
    (entry, field) => {
      if (!entry || !['id', 'dateBegin', 'dateEnd'].includes(field)) {
        return;
      }
      if (pendingIds.includes(entry.id) || newRow) {
        return;
      }
      const originalValue =
        field === 'id' ? String(entry.id ?? '') : typeof entry[field] === 'string' ? entry[field] : entry[field] || '';
      setActiveEdit({ id: entry.id, field, originalValue, value: originalValue });
      setFeedback({ type: '', text: '' });
    },
    [pendingIds, newRow],
  );

  const handleEditValueChange = React.useCallback((event) => {
    const { value } = event.target;
    setActiveEdit((current) => (current ? { ...current, value } : current));
  }, []);

  const handleCancelEdit = React.useCallback(() => {
    setActiveEdit(null);
  }, []);

  const handleConfirmEdit = React.useCallback(() => {
    if (!activeEdit) {
      return;
    }
    const rawValue = typeof activeEdit.value === 'string' ? activeEdit.value.trim() : '';
    const previousId = activeEdit.id;
    const field = activeEdit.field;
    let payload = {};

    if (field === 'id') {
      if (!rawValue || !/^\d+$/.test(rawValue)) {
        setFeedback({ type: 'error', text: t.contributeSeasonsIdInvalid });
        return;
      }
      const numericValue = Number.parseInt(rawValue, 10);
      if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
        setFeedback({ type: 'error', text: t.contributeSeasonsIdInvalid });
        return;
      }
      if (numericValue === previousId) {
        setActiveEdit(null);
        return;
      }
      payload = { id: numericValue };
    } else {
      if (!rawValue) {
        setFeedback({ type: 'error', text: t.contributeSeasonsDateRequired });
        return;
      }
      if (!isValidDate(rawValue)) {
        setFeedback({ type: 'error', text: t.contributeSeasonsDateInvalid });
        return;
      }
      if (rawValue === activeEdit.originalValue) {
        setActiveEdit(null);
        return;
      }
      const payloadKey = field === 'dateBegin' ? 'date_begin' : 'date_end';
      payload = { [payloadKey]: rawValue };
    }

    addPendingId(previousId);
    setFeedback({ type: '', text: '' });

    fetch(`${API_BASE_URL}/contributor/seasons/${previousId}`, {
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
              throw new Error(message || `Failed to update season: ${response.status}`);
            });
        }
        return response.json().catch(() => null);
      })
      .then((data) => {
        const updated = normaliseSeasonEntry(data || {});
        if (updated) {
          setSeasons((current) => {
            const filtered = current.filter((item) => item && item.id !== previousId);
            return sortSeasons([...(filtered || []), updated]);
          });
          setFeedback({ type: 'success', text: t.contributeSeasonsUpdateSuccess });
        }
        setActiveEdit(null);
      })
      .catch((errorResponse) => {
        console.error('Unable to update season', errorResponse);
        setFeedback({
          type: 'error',
          text:
            errorResponse && errorResponse.message
              ? errorResponse.message
              : t.contributeSeasonsUpdateError,
        });
      })
      .finally(() => {
        removePendingId(previousId);
      });
  }, [activeEdit, addPendingId, removePendingId, t]);

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

  const handleAddRow = React.useCallback(() => {
    if (newRow) {
      return;
    }
    setActiveEdit(null);
    setFeedback({ type: '', text: '' });
    setNewRow({ id: '', dateBegin: '', dateEnd: '' });
  }, [newRow]);

  const handleNewRowChange = React.useCallback((field, value) => {
    setNewRow((current) => (current ? { ...current, [field]: value } : current));
  }, []);

  const handleCancelNewRow = React.useCallback(() => {
    setNewRow(null);
  }, []);

  const handleCreateSeason = React.useCallback(() => {
    if (!newRow) {
      return;
    }
    const beginValue = typeof newRow.dateBegin === 'string' ? newRow.dateBegin.trim() : '';
    const endValue = typeof newRow.dateEnd === 'string' ? newRow.dateEnd.trim() : '';
    const idValue = typeof newRow.id === 'string' ? newRow.id.trim() : '';
    if (!beginValue || !endValue) {
      setFeedback({ type: 'error', text: t.contributeSeasonsDateRequired });
      return;
    }
    if (!isValidDate(beginValue) || !isValidDate(endValue)) {
      setFeedback({ type: 'error', text: t.contributeSeasonsDateInvalid });
      return;
    }
    if (idValue && !/^\d+$/.test(idValue)) {
      setFeedback({ type: 'error', text: t.contributeSeasonsIdInvalid });
      return;
    }
    const payload = { date_begin: beginValue, date_end: endValue };
    if (idValue) {
      const numericId = Number.parseInt(idValue, 10);
      if (!Number.isSafeInteger(numericId) || numericId <= 0) {
        setFeedback({ type: 'error', text: t.contributeSeasonsIdInvalid });
        return;
      }
      payload.id = numericId;
    }
    setFeedback({ type: '', text: '' });

    fetch(`${API_BASE_URL}/contributor/seasons`, {
      method: 'POST',
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
              throw new Error(message || `Failed to create season: ${response.status}`);
            });
        }
        return response.json().catch(() => null);
      })
      .then((data) => {
        const created = normaliseSeasonEntry(data || {});
        if (created) {
          setSeasons((current) => sortSeasons([...(current || []), created]));
          setFeedback({ type: 'success', text: t.contributeSeasonsCreateSuccess });
        }
        setNewRow(null);
      })
      .catch((creationError) => {
        console.error('Unable to create season', creationError);
        setFeedback({
          type: 'error',
          text:
            creationError && creationError.message
              ? creationError.message
              : t.contributeSeasonsCreateError,
        });
      });
  }, [newRow, t]);

  const handleDeleteSeason = React.useCallback(
    (entry) => {
      if (!entry || pendingIds.includes(entry.id) || newRow) {
        return;
      }
      const seasonId = entry.id;
      addPendingId(seasonId);
      setFeedback({ type: '', text: '' });

      fetch(`${API_BASE_URL}/contributor/seasons/${seasonId}`, { method: 'DELETE' })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .catch(() => null)
              .then((data) => {
                const message = data && typeof data.message === 'string' ? data.message : '';
                throw new Error(message || `Failed to delete season: ${response.status}`);
              });
          }
          return null;
        })
        .then(() => {
          setSeasons((current) => current.filter((item) => item && item.id !== seasonId));
          setFeedback({ type: 'success', text: t.contributeSeasonsDeleteSuccess });
        })
        .catch((deletionError) => {
          console.error('Unable to delete season', deletionError);
          setFeedback({
            type: 'error',
            text:
              deletionError && deletionError.message
                ? deletionError.message
                : t.contributeSeasonsDeleteError,
          });
        })
        .finally(() => {
          removePendingId(seasonId);
        });
    },
    [addPendingId, newRow, pendingIds, removePendingId, t],
  );

  const renderIdCell = (entry) => {
    const isEditing = activeEdit && activeEdit.id === entry.id && activeEdit.field === 'id';
    const pending = pendingIds.includes(entry.id);
    return (
      <th
        scope="row"
        className={`contribute-mutations-cell contribute-mutations-cell--editable${
          isEditing ? ' is-editing' : ''
        }${pending ? ' is-pending' : ''}`}
        onDoubleClick={() => handleStartEdit(entry, 'id')}
      >
        {isEditing ? (
          <input
            ref={editInputRef}
            type="number"
            min="1"
            step="1"
            value={activeEdit?.value ?? ''}
            onChange={handleEditValueChange}
            onKeyDown={handleEditKeyDown}
            disabled={pending}
          />
        ) : (
          <span>{entry.id}</span>
        )}
      </th>
    );
  };

  const renderDateCell = (entry, field) => {
    const isEditing = activeEdit && activeEdit.id === entry.id && activeEdit.field === field;
    const pending = pendingIds.includes(entry.id);
    const value = entry[field] || '';
    const label = value || t.contributeSeasonsUnknownValue;
    return (
      <td
        key={field}
        className={`contribute-mutations-cell contribute-mutations-cell--editable${
          isEditing ? ' is-editing' : ''
        }${pending ? ' is-pending' : ''}`}
        onDoubleClick={() => handleStartEdit(entry, field)}
      >
        {isEditing ? (
          <input
            ref={editInputRef}
            type="date"
            value={activeEdit?.value ?? ''}
            onChange={handleEditValueChange}
            onKeyDown={handleEditKeyDown}
            disabled={pending}
          />
        ) : (
          <span>{label}</span>
        )}
      </td>
    );
  };

  return (
    <section className="contribute-mutations contribute-seasons">
      <div className="contribute-mutations-toolbar">
        <p className="page-description">{t.contributeSeasonsDescription}</p>
        <div className="contribute-mutations-toolbar-actions">
          <button type="button" onClick={handleAddRow} disabled={loading || !!newRow}>
            {t.contributeSeasonsAdd}
          </button>
        </div>
      </div>
      <div className="contribute-mutations-table-container" aria-live="polite">
        {loading ? <p className="form-hint">{t.contributeSeasonsLoading}</p> : null}
        {error ? (
          <p className="form-message error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error ? (
          <table className="contribute-mutations-table">
            <thead>
              <tr>
                <th scope="col">{t.contributeSeasonsId}</th>
                <th scope="col">{t.contributeSeasonsDateBegin}</th>
                <th scope="col">{t.contributeSeasonsDateEnd}</th>
                <th scope="col">{t.contributeSeasonsActions}</th>
              </tr>
            </thead>
            <tbody>
              {newRow ? (
                <tr className="contribute-mutations-row is-new">
                  <th scope="row" className="contribute-mutations-cell">
                    <input
                      ref={newIdRef}
                      type="number"
                      min="1"
                      step="1"
                      value={newRow.id}
                      onChange={(event) => handleNewRowChange('id', event.target.value)}
                    />
                  </th>
                  <td className="contribute-mutations-cell">
                    <input
                      ref={newBeginRef}
                      type="date"
                      value={newRow.dateBegin}
                      onChange={(event) => handleNewRowChange('dateBegin', event.target.value)}
                    />
                  </td>
                  <td className="contribute-mutations-cell">
                    <input
                      type="date"
                      value={newRow.dateEnd}
                      onChange={(event) => handleNewRowChange('dateEnd', event.target.value)}
                    />
                  </td>
                  <td className="contribute-mutations-actions">
                    <button type="button" onClick={handleCreateSeason}>
                      {t.contributeSeasonsCreate}
                    </button>
                    <button type="button" className="secondary" onClick={handleCancelNewRow}>
                      {t.contributeSeasonsCancel}
                    </button>
                  </td>
                </tr>
              ) : null}
              {sortedSeasons.length === 0 && !newRow ? (
                <tr>
                  <td className="contribute-mutations-empty" colSpan={4}>
                    {t.contributeSeasonsEmpty}
                  </td>
                </tr>
              ) : null}
              {sortedSeasons.map((entry) => {
                const pending = pendingIds.includes(entry.id);
                return (
                  <tr
                    key={entry.id}
                    className={`contribute-mutations-row${pending ? ' is-pending' : ''}`}
                  >
                    {renderIdCell(entry)}
                    {renderDateCell(entry, 'dateBegin')}
                    {renderDateCell(entry, 'dateEnd')}
                    <td className="contribute-mutations-actions">
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteSeason(entry)}
                        disabled={pending}
                      >
                        {t.contributeSeasonsDelete}
                      </button>
                    </td>
                  </tr>
                );
              })}
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
