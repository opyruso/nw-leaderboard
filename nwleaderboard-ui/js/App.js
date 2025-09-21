import BottomNav from './BottomNav.js';
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
} from './auth.js';

const { BrowserRouter, Routes, Route, Navigate } = ReactRouterDOM;

export default function App() {
  const [token, setToken] = React.useState(() => {
    const stored =
      localStorage.getItem('tokens') || sessionStorage.getItem('tokens');
    if (stored) {
      const data = JSON.parse(stored);
      return data.access_token || null;
    }
    return null;
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
        </Routes>
        <BottomNav authenticated={authenticated} onLogout={handleLogout} />
      </BrowserRouter>
      <VersionChecker />
    </>
  );
}
