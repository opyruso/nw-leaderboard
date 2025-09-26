import { LangContext } from '../i18n.js';
import { getDungeonNameForLang, normaliseDungeons, sortDungeons, toPositiveInteger } from '../dungeons.js';
import { useDocumentTitle } from '../pageTitle.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function setsAreEqual(left, right) {
  if (left === right) {
    return true;
  }
  if (!left || !right || left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

export default function ContributeDungeons() {
  const { t, lang } = React.useContext(LangContext);
  const [dungeons, setDungeons] = React.useState([]);
  const [selected, setSelected] = React.useState(() => new Set());
  const [initial, setInitial] = React.useState(() => new Set());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState({ type: '', text: '' });

  const sectionTitle = React.useMemo(() => {
    const section = t.contributeMenuDungeons || t.dungeons || 'Dungeons';
    const base = t.contributeTitle || '';
    return base ? `${base} – ${section}` : section;
  }, [t]);

  useDocumentTitle(sectionTitle);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`${API_BASE_URL}/dungeons`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load dungeons: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const normalised = normaliseDungeons(data);
        setDungeons(normalised);
        const highlightedIds = normalised
          .filter((dungeon) => dungeon && dungeon.highlighted)
          .map((dungeon) => dungeon.id)
          .filter(Boolean);
        const initialSelection = new Set(highlightedIds);
        setSelected(initialSelection);
        setInitial(new Set(initialSelection));
      })
      .catch((fetchError) => {
        if (!active || fetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load dungeons', fetchError);
        setError(true);
        setDungeons([]);
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
  }, []);

  const sortedDungeons = React.useMemo(() => sortDungeons(dungeons, lang), [dungeons, lang]);
  const hasChanges = React.useMemo(() => !setsAreEqual(selected, initial), [selected, initial]);

  const handleToggle = React.useCallback((dungeonId) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(dungeonId)) {
        next.delete(dungeonId);
      } else {
        next.add(dungeonId);
      }
      return next;
    });
  }, []);

  const handleSave = React.useCallback(() => {
    const payloadIds = Array.from(selected)
      .map((id) => toPositiveInteger(id))
      .filter((id) => id !== null);
    setSaving(true);
    setFeedback({ type: '', text: '' });

    fetch(`${API_BASE_URL}/contributor/dungeons/highlights`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ highlighted_ids: payloadIds }),
    })
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .catch(() => null)
            .then((data) => {
              const message = data && typeof data.message === 'string' ? data.message : '';
              throw new Error(message || `Failed to update highlights: ${response.status}`);
            });
        }
        return response.json().catch(() => ({}));
      })
      .then((data) => {
        const message = data && typeof data.message === 'string' ? data.message : null;
        setInitial(new Set(selected));
        setFeedback({ type: 'success', text: message || t.contributeHighlightsSaved });
      })
      .catch((submitError) => {
        console.error('Unable to update dungeon highlights', submitError);
        const message = submitError && submitError.message ? submitError.message : t.contributeHighlightsError;
        setFeedback({ type: 'error', text: message });
      })
      .finally(() => setSaving(false));
  }, [selected, t]);

  return (
    <section className="contribute-dungeons">
      <p className="page-description">{t.contributeDungeonsDescription}</p>
      <div className="form contribute-dungeons-form" aria-live="polite">
        {loading ? <p className="form-hint">{t.contributeDungeonsLoading}</p> : null}
        {error ? (
          <p className="form-message" role="alert">
            {t.contributeDungeonsError}
          </p>
        ) : null}
        {!loading && !error ? (
          <>
            {sortedDungeons.length === 0 ? (
              <p className="form-hint">{t.dungeonSelectorEmpty}</p>
            ) : (
              <ul className="contribute-dungeon-list">
                {sortedDungeons.map((dungeon) => {
                  const id = dungeon.id;
                  const isSelected = selected.has(id);
                  const displayName = getDungeonNameForLang(dungeon, lang);
                  const expectedPlayers = toPositiveInteger(dungeon.playerCount);
                  let playerLabel = '';
                  if (expectedPlayers) {
                    if (typeof t.contributeDungeonExpectedPlayers === 'function') {
                      playerLabel = t.contributeDungeonExpectedPlayers(expectedPlayers);
                    } else if (typeof t.contributeDungeonExpectedPlayers === 'string') {
                      playerLabel = `${t.contributeDungeonExpectedPlayers} ${expectedPlayers}`;
                    } else {
                      playerLabel = `Expected players: ${expectedPlayers}`;
                    }
                  }
                  return (
                    <li key={id} className="contribute-dungeon-item">
                      <label
                        className={`contribute-dungeon-checkbox${isSelected ? ' active' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggle(id)}
                        />
                        <div className="contribute-dungeon-text">
                          <span className="contribute-dungeon-name">{displayName}</span>
                          {playerLabel ? (
                            <span className="contribute-dungeon-meta">{playerLabel}</span>
                          ) : null}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="form-actions">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? t.contributeHighlightsSaving : t.contributeHighlightsSave}
              </button>
            </div>
          </>
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
