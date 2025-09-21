const TOKEN_STORAGE_KEY = 'tokens';
const TOKEN_EXPIRY_BUFFER = 30 * 1000;
let refreshTimerId = null;
let fetchInitialised = false;

function readStoredTokens() {
  const raw =
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Unable to parse stored tokens', error);
    return null;
  }
}

function persistTokens(tokens, remember) {
  const storage = remember ? localStorage : sessionStorage;
  const backupStorage = remember ? sessionStorage : localStorage;
  backupStorage.removeItem(TOKEN_STORAGE_KEY);
  storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export function storeTokens(tokens, remember) {
  const now = Date.now();
  const expiresInMs = tokens.expires_in ? tokens.expires_in * 1000 : 15 * 60 * 1000;
  const withExpiry = {
    ...tokens,
    expires_at: tokens.expires_at || now + expiresInMs,
    stored_at: now,
  };
  persistTokens(withExpiry, remember);
  startTokenRefresh();
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  stopTokenRefresh();
}

function decodeAccessToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') {
    return null;
  }
  const parts = accessToken.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch (error) {
    console.warn('Unable to decode access token payload', error);
    return null;
  }
}

function collectRolesFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const accumulator = new Set();
  const addRole = (role) => {
    if (typeof role === 'string' && role.trim()) {
      accumulator.add(role.trim());
    }
  };

  if (Array.isArray(payload.groups)) {
    payload.groups.forEach(addRole);
  }
  if (payload.realm_access && Array.isArray(payload.realm_access.roles)) {
    payload.realm_access.roles.forEach(addRole);
  }
  if (payload.resource_access && typeof payload.resource_access === 'object') {
    Object.values(payload.resource_access).forEach((client) => {
      if (client && Array.isArray(client.roles)) {
        client.roles.forEach(addRole);
      }
    });
  }
  return Array.from(accumulator);
}

function hasClientRole(payload, clientId, roleName) {
  if (!payload || !payload.resource_access || typeof payload.resource_access !== 'object') {
    return false;
  }
  const entry = payload.resource_access[clientId];
  if (!entry || !Array.isArray(entry.roles)) {
    return false;
  }
  return entry.roles.some(
    (role) => typeof role === 'string' && role.toLowerCase() === String(roleName || '').toLowerCase(),
  );
}

export function hasContributorRole(tokens) {
  const source = tokens || readStoredTokens();
  if (!source || !source.access_token) {
    return false;
  }
  const payload = decodeAccessToken(source.access_token);
  if (!payload) {
    return false;
  }
  const roles = collectRolesFromPayload(payload);
  if (roles.some((role) => role.toLowerCase() === 'contributor')) {
    return true;
  }
  return hasClientRole(payload, 'nwleaderboard-app', 'contributor');
}

export function setupAuthFetch() {
  if (fetchInitialised) return;
  fetchInitialised = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const tokens = readStoredTokens();
    if (tokens && tokens.access_token) {
      const headers = new Headers(init.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${tokens.access_token}`);
      }
      init = { ...init, headers };
    }
    const response = await originalFetch(input, init);
    if (response.status === 401) {
      window.dispatchEvent(new Event('unauthenticated'));
    }
    return response;
  };
}

function scheduleRefresh() {
  stopTokenRefresh();
  const tokens = readStoredTokens();
  if (!tokens || !tokens.expires_at) {
    return;
  }
  const msUntilExpiry = tokens.expires_at - Date.now();
  if (msUntilExpiry <= 0) {
    window.dispatchEvent(new Event('unauthenticated'));
    return;
  }
  const delay = Math.max(msUntilExpiry - TOKEN_EXPIRY_BUFFER, 1000);
  refreshTimerId = window.setTimeout(() => {
    window.dispatchEvent(new Event('unauthenticated'));
  }, delay);
}

export function startTokenRefresh() {
  scheduleRefresh();
}

export function stopTokenRefresh() {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
}

export function getStoredTokens() {
  return readStoredTokens();
}

export function isAuthenticated() {
  const tokens = readStoredTokens();
  if (!tokens || !tokens.access_token) return false;
  if (tokens.expires_at && tokens.expires_at < Date.now()) {
    clearTokens();
    return false;
  }
  return true;
}
