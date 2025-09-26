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
import ContributeDungeons from './pages/ContributeDungeons.js';
import ContributeImport from './pages/ContributeImport.js';
import ContributeStats from './pages/ContributeStats.js';
import ContributePlayers from './pages/ContributePlayers.js';
import ContributeValidate from './pages/ContributeValidate.js';
import Player from './pages/Player.js';
import VersionChecker from './VersionChecker.js';
import Header from './Header.js';
import Footer from './Footer.js';
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
        <div className="app-shell">
          <Header
            authenticated={authenticated}
            canContribute={authState.canContribute}
            onLogout={handleLogout}
          />
          <main className="site-main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/score" element={<Score />} />
              <Route path="/time" element={<Time />} />
              <Route path="/individual" element={<Individual />} />
              <Route path="/leaderboard" element={<Navigate to="/score" replace />} />
              <Route path="/leaderboard/score" element={<Score />} />
              <Route path="/leaderboard/score/:dungeonId" element={<Score />} />
              <Route path="/leaderboard/time" element={<Time />} />
              <Route path="/leaderboard/time/:dungeonId" element={<Time />} />
              <Route path="/leaderboard/individual" element={<Individual />} />
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
                path="/contribute/*"
                element={
                  authenticated && authState.canContribute ? (
                    <Contribute />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              >
                <Route index element={<ContributeDungeons />} />
                <Route path="import" element={<ContributeImport />} />
                <Route path="validate" element={<ContributeValidate />} />
                <Route path="stats" element={<ContributeStats />} />
                <Route path="players" element={<ContributePlayers />} />
                <Route path="*" element={<Navigate to="." replace />} />
              </Route>
              <Route path="/player/:playerId?" element={<Player />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
      <VersionChecker />
    </>
  );
}
