import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');

function normalisePlayer(player) {
  if (!player || typeof player !== 'object') {
    return null;
  }
  const idValue = Number(player.id);
  const id = Number.isFinite(idValue) ? idValue : null;
  return {
    id,
    playerName:
      typeof player.player_name === 'string'
        ? player.player_name
        : typeof player.playerName === 'string'
        ? player.playerName
        : '',
    valid: Boolean(player.valid),
  };
}

function sortPlayers(list) {
  return [...list].sort((left, right) => {
    const leftName = (left?.playerName || '').toLocaleLowerCase();
    const rightName = (right?.playerName || '').toLocaleLowerCase();
    return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
  });
}

export default function ContributePlayers() {
  const { t } = React.useContext(LangContext);
  const [players, setPlayers] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [hideValid, setHideValid] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [editingName, setEditingName] = React.useState('');
  const [pendingIds, setPendingIds] = React.useState(() => new Set());
  const [feedback, setFeedback] = React.useState({ type: '', text: '' });

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setFeedback({ type: '', text: '' });

    fetch(`${API_BASE_URL}/contributor/players`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load players: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!active) {
          return;
        }
        if (!Array.isArray(data)) {
          setPlayers([]);
          return;
        }
        const normalised = data
          .map((item) => normalisePlayer(item))
          .filter((item) => item && item.id !== null);
        setPlayers(sortPlayers(normalised));
      })
      .catch((fetchError) => {
        if (!active || fetchError.name === 'AbortError') {
          return;
        }
        console.error('Unable to load players', fetchError);
        setError(true);
        setPlayers([]);
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

  const addPending = React.useCallback((playerId) => {
    setPendingIds((previous) => {
      const next = new Set(previous);
      if (playerId !== null && playerId !== undefined) {
        next.add(playerId);
      }
      return next;
    });
  }, []);

  const removePending = React.useCallback((playerId) => {
    setPendingIds((previous) => {
      const next = new Set(previous);
      next.delete(playerId);
      return next;
    });
  }, []);

  const applyUpdate = React.useCallback((payload) => {
    if (!payload || !payload.player) {
      return;
    }
    const updatedPlayer = normalisePlayer(payload.player);
    if (!updatedPlayer || updatedPlayer.id === null) {
      return;
    }
    const removedIdValue = Number(payload.removed_player_id ?? payload.removedPlayerId);
    const removedId = Number.isFinite(removedIdValue) ? removedIdValue : null;
    setPlayers((previous) => {
      const filtered = previous.filter((item) => item && item.id !== removedId);
      const next = [...filtered];
      const index = next.findIndex((item) => item && item.id === updatedPlayer.id);
      if (index >= 0) {
        next[index] = { ...next[index], ...updatedPlayer };
      } else {
        next.push(updatedPlayer);
      }
      return sortPlayers(next);
    });
  }, []);

  const handleToggleHideValid = React.useCallback(() => {
    setHideValid((previous) => !previous);
  }, []);

  const handleStartEditing = React.useCallback((player) => {
    if (!player || pendingIds.has(player.id)) {
      return;
    }
    setEditingId(player.id);
    setEditingName(player.playerName || '');
    setFeedback({ type: '', text: '' });
  }, [pendingIds]);

  const handleEditChange = React.useCallback((event) => {
    setEditingName(event.target.value);
  }, []);

  const mergeConfirmMessage = React.useCallback(
    (sourceName, targetName) => {
      if (typeof t.contributePlayerMergeConfirm === 'function') {
        return t.contributePlayerMergeConfirm(sourceName, targetName);
      }
      return `Merge ${sourceName} into ${targetName}?`;
    },
    [t],
  );

  const handleCommitEdit = React.useCallback(
    (playerId, name) => {
      const original = players.find((player) => player && player.id === playerId);
      if (!original) {
        setEditingId(null);
        setEditingName('');
        return;
      }
      const trimmed = typeof name === 'string' ? name.trim() : '';
      if (!trimmed) {
        const message = t.contributePlayerUpdateError || 'Unable to update this player.';
        setFeedback({ type: 'error', text: message });
        return;
      }
      if (trimmed === original.playerName) {
        setEditingId(null);
        setEditingName('');
        return;
      }
      const existing = players.find(
        (player) =>
          player &&
          player.id !== playerId &&
          typeof player.playerName === 'string' &&
          player.playerName.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        const confirmed = window.confirm(mergeConfirmMessage(original.playerName, existing.playerName));
        if (!confirmed) {
          return;
        }
      }

      addPending(playerId);
      setFeedback({ type: '', text: '' });

      fetch(`${API_BASE_URL}/contributor/players/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: trimmed }),
      })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .catch(() => null)
              .then((data) => {
                const message =
                  data && typeof data.message === 'string' ? data.message : t.contributePlayerUpdateError;
                throw new Error(message || `Failed to update player: ${response.status}`);
              });
          }
          return response.json();
        })
        .then((data) => {
          applyUpdate(data);
          setEditingId(null);
          setEditingName('');
        })
        .catch((error) => {
          console.error('Unable to rename player', error);
          const message = error && error.message ? error.message : t.contributePlayerUpdateError;
          setFeedback({ type: 'error', text: message || 'Unable to update this player.' });
        })
        .finally(() => {
          removePending(playerId);
        });
    },
    [addPending, applyUpdate, mergeConfirmMessage, players, removePending, t],
  );

  const handleEditBlur = React.useCallback(() => {
    if (editingId !== null) {
      handleCommitEdit(editingId, editingName);
    }
  }, [editingId, editingName, handleCommitEdit]);

  const handleEditKeyDown = React.useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleCommitEdit(editingId, editingName);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setEditingId(null);
        setEditingName('');
      }
    },
    [editingId, editingName, handleCommitEdit],
  );

  const handleToggleValidity = React.useCallback(
    (player) => {
      if (!player || pendingIds.has(player.id)) {
        return;
      }
      const nextValid = !player.valid;
      addPending(player.id);
      setFeedback({ type: '', text: '' });
      fetch(`${API_BASE_URL}/contributor/players/${player.id}/valid`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: nextValid }),
      })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .catch(() => null)
              .then((data) => {
                const message =
                  data && typeof data.message === 'string' ? data.message : t.contributePlayerUpdateError;
                throw new Error(message || `Failed to toggle validity: ${response.status}`);
              });
          }
          return response.json();
        })
        .then((data) => {
          applyUpdate(data);
        })
        .catch((error) => {
          console.error('Unable to toggle player validity', error);
          const message = error && error.message ? error.message : t.contributePlayerUpdateError;
          setFeedback({ type: 'error', text: message || 'Unable to update this player.' });
        })
        .finally(() => {
          removePending(player.id);
        });
    },
    [addPending, applyUpdate, pendingIds, removePending, t],
  );

  const visiblePlayers = React.useMemo(() => {
    if (!hideValid) {
      return players;
    }
    return players.filter((player) => !player.valid);
  }, [hideValid, players]);

  const isPending = React.useCallback((playerId) => pendingIds.has(playerId), [pendingIds]);

  return (
    <section className="contribute-players" aria-live="polite">
      <p className="page-description">
        {t.contributePlayersManageDescription ||
          'Manage player names and validity for leaderboard submissions.'}
      </p>
      <div className="contribute-players-controls">
        <label className="contribute-toggle-success">
          <input
            type="checkbox"
            className="contribute-toggle-success-input"
            checked={hideValid}
            onChange={handleToggleHideValid}
          />
          <span className="contribute-toggle-success-text">
            {t.contributePlayersHideValid || 'Hide valid players'}
          </span>
        </label>
        <p className="form-hint contribute-players-hint">
          {t.contributePlayersEditHint || 'Double-click a player to rename it.'}
        </p>
      </div>
      {loading ? <p className="form-hint">{t.contributePlayersLoading || 'Loading players…'}</p> : null}
      {error ? (
        <p className="form-message error" role="alert">
          {t.contributePlayersError || 'Unable to load players.'}
        </p>
      ) : null}
      {!loading && !error ? (
        visiblePlayers.length === 0 ? (
          <p className="form-hint">{t.contributePlayersEmpty || 'No players found.'}</p>
        ) : (
          <ul className="contribute-player-grid contribute-players-grid">
            {visiblePlayers.map((player) => {
              const active = editingId === player.id;
              const pending = isPending(player.id);
              const statusClass = player.valid ? 'status-success' : 'status-warning';
              return (
                <li
                  key={player.id}
                  className={`contribute-player-card ${statusClass}${pending ? ' is-pending' : ''}`}
                  onDoubleClick={() => handleStartEditing(player)}
                >
                  <div className="contribute-player-card-name">
                    {active ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={handleEditChange}
                        onBlur={handleEditBlur}
                        onKeyDown={handleEditKeyDown}
                        placeholder={t.contributePlayerRenamePlaceholder || 'Player name'}
                        disabled={pending}
                        autoFocus
                      />
                    ) : (
                      <span>{player.playerName}</span>
                    )}
                  </div>
                  <div className="contribute-player-card-valid">
                    <span className="contribute-player-card-label">
                      {t.contributePlayerValidLabel || 'Valid'}
                    </span>
                    <label className="contribute-toggle-success">
                      <input
                        type="checkbox"
                        className="contribute-toggle-success-input"
                        checked={player.valid}
                        onChange={() => handleToggleValidity(player)}
                        disabled={pending}
                        aria-label={t.contributePlayerValidLabel || 'Valid'}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
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
