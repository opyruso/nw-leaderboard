import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const LANGUAGE_ORDER = ['en', 'fr', 'de', 'es', 'esmx', 'it', 'pl', 'pt'];

function toInputDate(value) {
  if (!value) return '';
  if (value.length >= 19) {
    return value.slice(0, 19);
  }
  if (value.length === 16) {
    return `${value}:00`;
  }
  return value;
}

function toPayloadDate(value) {
  if (!value) return '';
  return value.length === 16 ? `${value}:00` : value;
}

function buildInitialState(entry) {
  return {
    title: entry?.title || '',
    content_en: entry?.content_en || '',
    content_fr: entry?.content_fr || '',
    content_de: entry?.content_de || '',
    content_es: entry?.content_es || '',
    content_esmx: entry?.content_esmx || '',
    content_it: entry?.content_it || '',
    content_pl: entry?.content_pl || '',
    content_pt: entry?.content_pt || '',
    start_date: toInputDate(entry?.start_date || ''),
    end_date: toInputDate(entry?.end_date || ''),
  };
}

export default function Announcements() {
  const { t } = React.useContext(LangContext);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [announcements, setAnnouncements] = React.useState([]);
  const [expandedId, setExpandedId] = React.useState(null);
  const [formState, setFormState] = React.useState({});
  const [savingId, setSavingId] = React.useState(null);
  const [deletingId, setDeletingId] = React.useState(null);
  const [creating, setCreating] = React.useState(false);

  const loadAnnouncements = React.useCallback(() => {
    if (!API_BASE_URL) {
      setError(t.announcementsLoadError || 'Unable to load announcements.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/announcements/admin`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load announcements');
        }
        return response.json();
      })
      .then((data) => {
        setAnnouncements(Array.isArray(data) ? data : []);
      })
      .catch((fetchError) => {
        console.error('Unable to load announcements', fetchError);
        setError(t.announcementsLoadError || 'Unable to load announcements.');
      })
      .finally(() => setLoading(false));
  }, [t]);

  React.useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleToggle = (entry) => {
    if (!entry || !entry.id) {
      return;
    }
    const entryId = entry.id;
    setExpandedId((current) => {
      const next = current === entryId ? null : entryId;
      if (next) {
        setFormState((previous) => ({
          ...previous,
          [entryId]: previous[entryId] || buildInitialState(entry),
        }));
      }
      return next;
    });
  };

  const handleFieldChange = (entryId, field, value) => {
    setFormState((previous) => ({
      ...previous,
      [entryId]: {
        ...(previous[entryId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = (entryId) => {
    if (!API_BASE_URL || !entryId) {
      return;
    }
    const state = formState[entryId];
    if (!state) {
      return;
    }
    setSavingId(entryId);
    const payload = {
      title: state.title,
      content_en: state.content_en,
      content_fr: state.content_fr,
      content_de: state.content_de,
      content_es: state.content_es,
      content_esmx: state.content_esmx,
      content_it: state.content_it,
      content_pl: state.content_pl,
      content_pt: state.content_pt,
      start_date: toPayloadDate(state.start_date),
      end_date: toPayloadDate(state.end_date),
    };
    fetch(`${API_BASE_URL}/announcements/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to save announcement');
        }
        return response.json();
      })
      .then((updated) => {
        setAnnouncements((previous) =>
          previous.map((item) => (item.id === updated.id ? updated : item)),
        );
        setFormState((previous) => ({
          ...previous,
          [entryId]: buildInitialState(updated),
        }));
      })
      .catch((saveError) => {
        console.error('Unable to save announcement', saveError);
        window.alert(t.announcementsSaveError || 'Unable to save announcement.');
      })
      .finally(() => setSavingId(null));
  };

  const handleDelete = (entryId) => {
    if (!API_BASE_URL || !entryId) {
      return;
    }
    const confirmMessage = t.announcementsDeleteConfirm || 'Delete this announcement?';
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setDeletingId(entryId);
    fetch(`${API_BASE_URL}/announcements/${entryId}`, { method: 'DELETE' })
      .then((response) => {
        if (!response.ok && response.status !== 204) {
          throw new Error('Unable to delete announcement');
        }
        setAnnouncements((previous) => previous.filter((item) => item.id !== entryId));
        setFormState((previous) => {
          const next = { ...previous };
          delete next[entryId];
          return next;
        });
        setExpandedId((current) => (current === entryId ? null : current));
      })
      .catch((deleteError) => {
        console.error('Unable to delete announcement', deleteError);
        window.alert(t.announcementsDeleteError || 'Unable to delete announcement.');
      })
      .finally(() => setDeletingId(null));
  };

  const handleCreate = () => {
    if (!API_BASE_URL) {
      return;
    }
    setCreating(true);
    fetch(`${API_BASE_URL}/announcements`, { method: 'POST' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to create announcement');
        }
        return response.json();
      })
      .then((created) => {
        setAnnouncements((previous) => [created, ...previous]);
        setFormState((previous) => ({
          ...previous,
          [created.id]: buildInitialState(created),
        }));
        setExpandedId(created.id);
      })
      .catch((createError) => {
        console.error('Unable to create announcement', createError);
        window.alert(t.announcementsCreateError || 'Unable to create announcement.');
      })
      .finally(() => setCreating(false));
  };

  const languageLabels = t.languageOptions || {};

  return (
    <main className="page announcement-page" aria-labelledby="announcement-admin-title">
      <div className="page-header">
        <h1 id="announcement-admin-title" className="page-title">
          {t.announcementsPageTitle || 'Announcements'}
        </h1>
        <p className="page-description">
          {t.announcementsPageDescription || 'Manage announcements displayed to players.'}
        </p>
        <button
          type="button"
          className="button"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating
            ? t.announcementsCreating || 'Creating...'
            : t.announcementsAddButton || 'Add announcement'}
        </button>
      </div>
      {loading ? (
        <div className="announcement-status">
          {t.loading || 'Loading...'}
        </div>
      ) : error ? (
        <div className="announcement-status announcement-status--error">{error}</div>
      ) : announcements.length === 0 ? (
        <div className="announcement-status">
          {t.announcementsEmptyState || 'No announcements yet.'}
        </div>
      ) : (
        <ul className="announcement-list">
          {announcements.map((entry) => {
            const entryId = entry.id;
            const state = formState[entryId] || buildInitialState(entry);
            const isExpanded = expandedId === entryId;
            return (
              <li key={entryId} className="announcement-item">
                <button
                  type="button"
                  className="announcement-item__toggle"
                  onClick={() => handleToggle(entry)}
                  aria-expanded={isExpanded ? 'true' : 'false'}
                >
                  <span className="announcement-item__title">{entry.title}</span>
                  <span className="announcement-item__dates">
                    {state.start_date && state.end_date
                      ? `${state.start_date} → ${state.end_date}`
                      : t.announcementsNoDates || 'No schedule defined'}
                  </span>
                </button>
                {isExpanded ? (
                  <form
                    className="announcement-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSave(entryId);
                    }}
                  >
                    <div className="announcement-form__field">
                      <label htmlFor={`announcement-title-${entryId}`}>
                        {t.announcementsTitle || 'Title'}
                      </label>
                      <input
                        id={`announcement-title-${entryId}`}
                        type="text"
                        value={state.title}
                        onChange={(event) =>
                          handleFieldChange(entryId, 'title', event.target.value)
                        }
                        required
                      />
                    </div>
                    <div className="announcement-form__grid">
                      <div className="announcement-form__field">
                        <label htmlFor={`announcement-start-${entryId}`}>
                          {t.announcementsStartDate || 'Start date'}
                        </label>
                        <input
                          id={`announcement-start-${entryId}`}
                          type="datetime-local"
                          value={state.start_date}
                          onChange={(event) =>
                            handleFieldChange(entryId, 'start_date', event.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="announcement-form__field">
                        <label htmlFor={`announcement-end-${entryId}`}>
                          {t.announcementsEndDate || 'End date'}
                        </label>
                        <input
                          id={`announcement-end-${entryId}`}
                          type="datetime-local"
                          value={state.end_date}
                          onChange={(event) =>
                            handleFieldChange(entryId, 'end_date', event.target.value)
                          }
                          required
                        />
                      </div>
                    </div>
                    {LANGUAGE_ORDER.map((code) => (
                      <div className="announcement-form__field" key={code}>
                        <label htmlFor={`announcement-${code}-${entryId}`}>
                          {(t.announcementsContentLabel || 'Content') +
                            ` (${languageLabels[code] || code})`}
                        </label>
                        <textarea
                          id={`announcement-${code}-${entryId}`}
                          value={state[`content_${code}`] || ''}
                          onChange={(event) =>
                            handleFieldChange(entryId, `content_${code}`, event.target.value)
                          }
                          required
                          rows={4}
                        />
                      </div>
                    ))}
                    <div className="announcement-form__actions">
                      <button
                        type="submit"
                        className="button button--primary"
                        disabled={savingId === entryId}
                      >
                        {savingId === entryId
                          ? t.announcementsSaving || 'Saving...'
                          : t.announcementsSave || 'Save'}
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => handleDelete(entryId)}
                        disabled={deletingId === entryId}
                      >
                        {deletingId === entryId
                          ? t.announcementsDeleting || 'Deleting...'
                          : t.announcementsDelete || 'Delete'}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
