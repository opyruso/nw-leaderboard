import BottomNav from './BottomNav.js';
import Home from './pages/Home.js';
import Score from './pages/Score.js';
import Time from './pages/Time.js';
import Individual from './pages/Individual.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import ForgotPassword from './pages/ForgotPassword.js';
import Preferences from './pages/Preferences.js';
import Password from './pages/Password.js';
import Contribute from './pages/Contribute.js';
import VersionChecker from './VersionChecker.js';
import {
  storeTokens,
  clearTokens,
  setupAuthFetch,
  startTokenRefresh,
  stopTokenRefresh,
  getStoredTokens,
  hasContributorRole,
} from './auth.js';

const { BrowserRouter, Routes, Route, Navigate } = ReactRouterDOM;

export default function App() {
  const [authState, setAuthState] = React.useState(() => {
    const stored = getStoredTokens();
    return {
      token: stored && stored.access_token ? stored.access_token : null,
      canContribute: hasContributorRole(stored),
    };
  });

  const handleLogout = React.useCallback(() => {
    setAuthState({ token: null, canContribute: false });
    clearTokens();
    stopTokenRefresh();
  }, []);

  React.useEffect(() => {
    setupAuthFetch();
    window.addEventListener('unauthenticated', handleLogout);
    return () => window.removeEventListener('unauthenticated', handleLogout);
  }, [handleLogout]);

  React.useEffect(() => {
    if (authState.token) {
      startTokenRefresh();
      return () => stopTokenRefresh();
    }
  }, [authState.token]);

  const handleLogin = (tokens, remember) => {
    storeTokens(tokens, remember);
    setAuthState({
      token: tokens && tokens.access_token ? tokens.access_token : null,
      canContribute: hasContributorRole(tokens),
    });
  };

  const authenticated = !!authState.token;

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/score" element={<Score />} />
          <Route path="/time" element={<Time />} />
          <Route path="/individual" element={<Individual />} />
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
          <Route
            path="/contribute"
            element={
              authenticated && authState.canContribute ? (
                <Contribute />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav
          authenticated={authenticated}
          canContribute={authState.canContribute}
          onLogout={handleLogout}
        />
      </BrowserRouter>
      <VersionChecker />
    </>
  );
}
