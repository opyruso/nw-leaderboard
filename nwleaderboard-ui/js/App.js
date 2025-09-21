import BottomNav from './BottomNav.js';
import Home from './pages/Home.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import ForgotPassword from './pages/ForgotPassword.js';
import Preferences from './pages/Preferences.js';
import Password from './pages/Password.js';
import VersionChecker from './VersionChecker.js';
import {
  storeTokens,
  clearTokens,
  setupAuthFetch,
  startTokenRefresh,
  stopTokenRefresh,
  getStoredTokens,
} from './auth.js';

const { BrowserRouter, Routes, Route, Navigate } = ReactRouterDOM;

export default function App() {
  const [token, setToken] = React.useState(() => {
    const stored = getStoredTokens();
    return stored && stored.access_token ? stored.access_token : null;
  });

  const handleLogout = React.useCallback(() => {
    setToken(null);
    clearTokens();
    stopTokenRefresh();
  }, []);

  React.useEffect(() => {
    setupAuthFetch();
    window.addEventListener('unauthenticated', handleLogout);
    return () => window.removeEventListener('unauthenticated', handleLogout);
  }, [handleLogout]);

  React.useEffect(() => {
    if (token) {
      startTokenRefresh();
      return () => stopTokenRefresh();
    }
  }, [token]);

  const handleLogin = (tokens, remember) => {
    setToken(tokens.access_token);
    storeTokens(tokens, remember);
  };

  const authenticated = !!token;

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/login"
            element={
              authenticated ? (
                <Navigate to="/" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/password"
            element={
              authenticated ? <Password /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/preferences"
            element={
              authenticated ? <Preferences /> : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav authenticated={authenticated} onLogout={handleLogout} />
      </BrowserRouter>
      <VersionChecker />
    </>
  );
}
