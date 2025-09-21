const KeycloakCtor = window.Keycloak;

const keycloak = new KeycloakCtor({
  url: window.CONFIG['auth-url'],
  realm: window.CONFIG['auth-realm'],
  clientId: window.CONFIG['auth-client-id'],
});

let refreshInterval;
const LONG_TOKEN_KEY = 'longTimeToken';

export async function init() {
  let authenticated = await keycloak
    .init({ onLoad: 'check-sso', checkLoginIframe: false })
    .catch(() => false);
  if (!authenticated) {
    authenticated = await refreshWithLongTimeToken();
  }
  if (authenticated) {
    storeLongTimeToken();
    startTokenRefresh();
  }
  setupFetchInterceptor();
  return authenticated;
}

function startTokenRefresh() {
  clearInterval(refreshInterval);
  refreshInterval = setInterval(async () => {
    try {
      await keycloak.updateToken(60);
      storeLongTimeToken();
    } catch {
      if (!(await refreshWithLongTimeToken())) {
        handleAuthLoss();
      }
    }
  }, 10000);
}

function setupFetchInterceptor() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    if (keycloak.token) {
      try {
        await keycloak.updateToken(60);
        storeLongTimeToken();
      } catch {
        const refreshed = await refreshWithLongTimeToken();
        if (!refreshed) {
          handleAuthLoss();
        }
      }
    }
    const headers = new Headers(options.headers || {});
    if (keycloak.token) {
      headers.set('Authorization', `Bearer ${keycloak.token}`);
    }
    return originalFetch(url, { ...options, headers });
  };
}

function parseToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

function storeLongTimeToken() {
  if (keycloak.refreshToken) {
    localStorage.setItem(LONG_TOKEN_KEY, keycloak.refreshToken);
  }
}

async function refreshWithLongTimeToken() {
  const longTimeToken = localStorage.getItem(LONG_TOKEN_KEY);
  if (!longTimeToken) return false;
  try {
    const tokenUrl = `${window.CONFIG['auth-url']}/realms/${window.CONFIG['auth-realm']}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: window.CONFIG['auth-client-id'],
      refresh_token: longTimeToken,
    });
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error('long time token failed');
    const data = await res.json();
    keycloak.token = data.access_token;
    keycloak.refreshToken = data.refresh_token;
    keycloak.idToken = data.id_token;
    keycloak.tokenParsed = parseToken(data.access_token);
    keycloak.refreshTokenParsed = parseToken(data.refresh_token);
    keycloak.idTokenParsed = data.id_token ? parseToken(data.id_token) : undefined;
    keycloak.timeSkew = Math.floor(Date.now() / 1000) - keycloak.tokenParsed.iat;
    storeLongTimeToken();
    return true;
  } catch {
    localStorage.removeItem(LONG_TOKEN_KEY);
    return false;
  }
}

function handleAuthLoss() {
  keycloak.clearToken();
  localStorage.removeItem(LONG_TOKEN_KEY);
  window.dispatchEvent(new Event('unauthenticated'));
}

export const login = (options) => keycloak.login(options);
export const logout = (options) => {
  clearInterval(refreshInterval);
  localStorage.removeItem(LONG_TOKEN_KEY);
  return keycloak.logout(options);
};

export const hasRealmRole = (role) =>
  keycloak && keycloak.hasRealmRole && keycloak.hasRealmRole(role);
export const hasResourceRole = (role, resource) =>
  keycloak &&
  keycloak.hasResourceRole &&
  keycloak.hasResourceRole(role, resource);

export const getUserId = () => keycloak.tokenParsed?.sub;

export default keycloak;
