export function getRawPlayerId(player) {
  if (!player || typeof player !== 'object') {
    return null;
  }
  const candidate =
    player.playerId ??
    player.player_id ??
    player.id ??
    player.id_player ??
    player.identifier ??
    null;
  if (candidate === null || candidate === undefined) {
    return null;
  }
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return String(candidate);
  }
  return null;
}

export function getPlayerNames(player) {
  if (!player || typeof player !== 'object') {
    return {
      playerName: '',
      mainPlayerName: '',
      displayName: '',
      tooltip: '',
      isAlt: false,
      playerId: null,
      mainPlayerId: null,
    };
  }

  const extractName = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '';
  };

  const playerName =
    extractName(player.playerName) ||
    extractName(player.player_name) ||
    extractName(player.name) ||
    extractName(player.label) ||
    extractName(player.displayName) ||
    extractName(player.username) ||
    extractName(player.fullName);

  const mainPlayerName =
    extractName(player.mainPlayerName) ||
    extractName(player.main_player_name);

  const mainPlayerIdRaw =
    player.mainPlayerId ??
    player.main_player_id ??
    player.mainId ??
    player.main_id ??
    null;
  const mainPlayerId =
    mainPlayerIdRaw === null || mainPlayerIdRaw === undefined
      ? null
      : typeof mainPlayerIdRaw === 'number'
      ? Number.isFinite(mainPlayerIdRaw)
        ? String(mainPlayerIdRaw)
        : null
      : typeof mainPlayerIdRaw === 'string'
      ? mainPlayerIdRaw.trim() || null
      : null;

  const playerId = getRawPlayerId(player);
  const isAlt = Boolean((mainPlayerId && mainPlayerId.length > 0) || (mainPlayerName && mainPlayerName.length > 0));
  const displayName = isAlt && mainPlayerName ? `${mainPlayerName}*` : playerName;
  const tooltip = isAlt ? playerName || mainPlayerName : '';

  return {
    playerName,
    mainPlayerName,
    displayName,
    tooltip,
    isAlt,
    playerId,
    mainPlayerId,
  };
}

export function formatPlayerLinkProps(player) {
  const info = getPlayerNames(player);
  return {
    id: info.playerId,
    displayName: info.displayName || info.playerName || '',
    tooltip: info.tooltip,
    mainId: info.mainPlayerId,
    mainName: info.mainPlayerName,
    isAlt: info.isAlt,
    playerName: info.playerName,
  };
}
