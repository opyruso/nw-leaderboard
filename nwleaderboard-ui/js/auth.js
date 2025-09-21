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
