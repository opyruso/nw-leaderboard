const TOKEN_STORAGE_KEY = 'tokens';
const TOKEN_EXPIRY_BUFFER = 30 * 1000;
const AUTH_CONFIG = window.CONFIG || {};
const AUTH_SERVER_URL = AUTH_CONFIG['auth-url'];
const AUTH_REALM = AUTH_CONFIG['auth-realm'];
const AUTH_CLIENT_ID = AUTH_CONFIG['auth-client-id'];
const AUTH_CLIENT_SECRET = AUTH_CONFIG['auth-client-secret'];
const TOKEN_ENDPOINT =
  AUTH_SERVER_URL && AUTH_REALM
    ? `${AUTH_SERVER_URL}/realms/${AUTH_REALM}/protocol/openid-connect/token`
    : null;
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
  if (!tokens || !tokens.access_token) {
    throw new Error('Cannot store empty tokens');
  }
  const now = Date.now();
  const expiresInMs = tokens.expires_in ? tokens.expires_in * 1000 : 15 * 60 * 1000;
  const refreshExpiresInMs =
    typeof tokens.refresh_expires_in === 'number' && tokens.refresh_expires_in > 0
      ? tokens.refresh_expires_in * 1000
      : null;
  const withExpiry = {
    ...tokens,
    expires_at: tokens.expires_at || now + expiresInMs,
    refresh_expires_at: tokens.refresh_expires_at || (refreshExpiresInMs ? now + refreshExpiresInMs : null),
    stored_at: now,
    remember: !!remember,
  };
  if (remember && tokens.refresh_token) {
    withExpiry.offline_token = tokens.offline_token || tokens.refresh_token;
  } else if (!remember && withExpiry.offline_token) {
    delete withExpiry.offline_token;
  }
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
  if (tokens.refresh_expires_at && tokens.refresh_expires_at <= Date.now()) {
    window.dispatchEvent(new Event('unauthenticated'));
    return;
  }
  const msUntilExpiry = tokens.expires_at - Date.now();
  if (msUntilExpiry <= TOKEN_EXPIRY_BUFFER) {
    attemptTokenRefresh();
    return;
  }
  const delay = Math.max(msUntilExpiry - TOKEN_EXPIRY_BUFFER, 1000);
  refreshTimerId = window.setTimeout(() => {
    attemptTokenRefresh();
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
  return true;
}

function buildFormData(params) {
  const form = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      form.set(key, value);
    }
  });
  return form.toString();
}

async function requestToken(formData) {
  if (!TOKEN_ENDPOINT) {
    throw new Error('Authentication server not configured');
  }
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error('Authentication request failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  if (!payload || !payload.access_token) {
    throw new Error('Authentication server returned an invalid payload');
  }
  return payload;
}

async function attemptTokenRefresh() {
  try {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      window.dispatchEvent(new Event('unauthenticated'));
    }
  } catch (error) {
    console.warn('Token refresh failed', error);
    window.dispatchEvent(new Event('unauthenticated'));
  }
}

export async function loginWithPassword(username, password, remember) {
  const params = {
    grant_type: 'password',
    client_id: AUTH_CLIENT_ID,
    username,
    password,
    scope: remember ? 'openid offline_access' : 'openid',
  };
  if (AUTH_CLIENT_SECRET) {
    params.client_secret = AUTH_CLIENT_SECRET;
  }
  const formData = buildFormData(params);
  return requestToken(formData);
}

export async function refreshTokens() {
  const tokens = readStoredTokens();
  if (!tokens) {
    return false;
  }
  if (tokens.refresh_expires_at && tokens.refresh_expires_at <= Date.now()) {
    return false;
  }
  const refreshToken = tokens.refresh_token || tokens.offline_token;
  if (!refreshToken) {
    return false;
  }
  const params = {
    grant_type: 'refresh_token',
    client_id: AUTH_CLIENT_ID,
    refresh_token: refreshToken,
  };
  if (AUTH_CLIENT_SECRET) {
    params.client_secret = AUTH_CLIENT_SECRET;
  }
  const formData = buildFormData(params);
  try {
    const payload = await requestToken(formData);
    const remember = !!tokens.remember;
    const merged = {
      ...tokens,
      ...payload,
    };
    if (tokens.offline_token) {
      merged.offline_token = payload.refresh_token || tokens.offline_token;
    }
    storeTokens(merged, remember);
    return true;
  } catch (error) {
    console.warn('Unable to refresh tokens', error);
    return false;
  }
}
