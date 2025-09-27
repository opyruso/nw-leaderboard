import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const SUGGESTION_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'PUT_ON_TODO_LIST',
  'REFUSED',
  'FIXED',
];

export default function Suggestions({ isAdmin }) {
  const { t, lang } = React.useContext(LangContext);
  const [form, setForm] = React.useState({ title: '', content: '' });
  const [submitState, setSubmitState] = React.useState('idle');
  const [feedback, setFeedback] = React.useState({ type: '', message: '' });
  const [suggestions, setSuggestions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [expandedId, setExpandedId] = React.useState(null);
  const [updatingId, setUpdatingId] = React.useState(null);

  const statusLabels = t.suggestionsStatus || {};

  const locale = lang === 'esmx' ? 'es-MX' : lang || 'en';

  const formatDate = React.useCallback(
    (value) => {
      if (!value) {
        return '';
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      try {
        return new Intl.DateTimeFormat(locale, {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(date);
      } catch (error) {
        return date.toLocaleString();
      }
    },
    [locale]
  );

  const fetchSuggestions = React.useCallback(async () => {
    if (!API_BASE_URL) {
      setSuggestions([]);
      setLoading(false);
      setLoadError(t.suggestionsLoadError);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const endpoint = isAdmin ? '/suggestions/admin' : '/suggestions/mine';
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      setSuggestions(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.warn('Unable to load suggestions', error);
      setLoadError(t.suggestionsLoadError);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]);

  React.useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetFeedback = () => setFeedback({ type: '', message: '' });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isAdmin) {
      return;
    }
    resetFeedback();
    if (!API_BASE_URL) {
      setFeedback({ type: 'error', message: t.suggestionsFormError });
      return;
    }
    setSubmitState('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setFeedback({ type: 'success', message: t.suggestionsFormSuccess });
      setForm({ title: '', content: '' });
      fetchSuggestions();
    } catch (error) {
      console.warn('Unable to submit suggestion', error);
      setFeedback({ type: 'error', message: t.suggestionsFormError });
    } finally {
      setSubmitState('idle');
    }
  };

  const handleStatusChange = async (id, nextStatus) => {
    if (!isAdmin || !nextStatus || updatingId === id) {
      return;
    }
    resetFeedback();
    setUpdatingId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/suggestions/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setFeedback({ type: 'success', message: t.suggestionsStatusUpdateSuccess });
      fetchSuggestions();
    } catch (error) {
      console.warn('Unable to update suggestion status', error);
      setFeedback({ type: 'error', message: t.suggestionsStatusUpdateError });
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpanded = (id) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const renderStatusLabel = (status) => statusLabels[status] || status;

  const renderList = () => {
    if (loading) {
      return <p className="suggestion-message">{t.suggestionsLoading}</p>;
    }
    if (loadError) {
      return <p className="form-message error">{loadError}</p>;
    }
    if (!suggestions.length) {
      return (
        <p className="suggestion-message">
          {isAdmin ? t.suggestionsAdminEmpty : t.suggestionsListEmpty}
        </p>
      );
    }
    return (
      <ul className="suggestion-list">
        {suggestions.map((item) => {
          const createdAt = formatDate(item.created_at);
          const expanded = expandedId === item.id;
          return (
            <li key={item.id} className="form suggestion-card">
              <div className="suggestion-item__row">
                <button
                  type="button"
                  className="suggestion-item__summary"
                  onClick={() => toggleExpanded(item.id)}
                >
                  <span className="suggestion-item__title">{item.title}</span>
                  <span className="suggestion-item__meta">
                    {createdAt ? <span>{createdAt}</span> : null}
                    <span className="suggestion-status-badge">
                      {renderStatusLabel(item.status)}
                    </span>
                  </span>
                </button>
                {isAdmin ? (
                  <label className="form-field suggestion-item__status" onClick={(event) => event.stopPropagation()}>
                    <span>{t.suggestionsAdminStatusLabel}</span>
                    <select
                      value={item.status}
                      onChange={(event) => handleStatusChange(item.id, event.target.value)}
                      disabled={updatingId === item.id}
                    >
                      {SUGGESTION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {renderStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              {expanded ? (
                <div className="suggestion-item__details">
                  {isAdmin && item.author ? (
                    <p className="suggestion-item__author">{t.suggestionsAdminAuthor(item.author)}</p>
                  ) : null}
                  <p className="suggestion-item__content">{item.content}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <main className="page suggestion-page" aria-labelledby="suggestion-title">
      <h1 id="suggestion-title" className="page-title">
        {t.suggestionsTitle}
      </h1>
      <p className="page-description">
        {isAdmin ? t.suggestionsAdminDescription : t.suggestionsDescription}
      </p>
      {!isAdmin ? (
        <form className="form suggestion-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>{t.suggestionsFormTitle}</span>
            <input
              name="title"
              type="text"
              value={form.title}
              onChange={updateField}
              maxLength={200}
              required
            />
          </label>
          <label className="form-field">
            <span>{t.suggestionsFormContent}</span>
            <textarea
              name="content"
              value={form.content}
              onChange={updateField}
              rows={20}
              maxLength={5000}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={submitState === 'loading'}>
              {submitState === 'loading' ? '…' : t.suggestionsFormSubmit}
            </button>
          </div>
          {feedback.message ? (
            <p className={`form-message${feedback.type === 'error' ? ' error' : ''}`}>
              {feedback.message}
            </p>
          ) : null}
        </form>
      ) : null}
      <section className="suggestion-section" aria-live="polite">
        <h2 className="visually-hidden">
          {isAdmin ? t.suggestionsAdminListTitle : t.suggestionsListTitle}
        </h2>
        {renderList()}
      </section>
      {isAdmin && feedback.message ? (
        <p className={`form-message${feedback.type === 'error' ? ' error' : ''}`}>
          {feedback.message}
        </p>
      ) : null}
    </main>
  );
}
