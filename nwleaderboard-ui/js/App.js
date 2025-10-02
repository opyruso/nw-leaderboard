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
import ContributeMutations from './pages/ContributeMutations.js';
import ContributeSeasons from './pages/ContributeSeasons.js';
import ContributeStats from './pages/ContributeStats.js';
import ContributePlayers from './pages/ContributePlayers.js';
import ContributeValidate from './pages/ContributeValidate.js';
import ContributeRuns from './pages/ContributeRuns.js';
import Player from './pages/Player.js';
import Relationship from './pages/Relationship.js';
import Suggestions from './pages/Suggestions.js';
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
  hasAdminRole,
} from './auth.js';

const { BrowserRouter, Routes, Route, Navigate } = ReactRouterDOM;

export default function App() {
  const [authState, setAuthState] = React.useState(() => {
    const stored = getStoredTokens();
    return {
      token: stored && stored.access_token ? stored.access_token : null,
      canContribute: hasContributorRole(stored),
      isAdmin: hasAdminRole(stored),
    };
  });

  const handleLogout = React.useCallback(() => {
    setAuthState({ token: null, canContribute: false, isAdmin: false });
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
      isAdmin: hasAdminRole(tokens),
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
                element={<Preferences isAuthenticated={authenticated} />}
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
                <Route path="mutations" element={<ContributeMutations />} />
                <Route path="seasons" element={<ContributeSeasons />} />
                <Route path="import" element={<ContributeImport />} />
                <Route path="validate" element={<ContributeValidate />} />
                <Route path="stats" element={<ContributeStats />} />
                <Route path="players" element={<ContributePlayers />} />
                <Route path="runs" element={<ContributeRuns />} />
                <Route path="*" element={<Navigate to="." replace />} />
              </Route>
              <Route
                path="/suggestions"
                element={<Suggestions isAdmin={authState.isAdmin} />}
              />
              <Route path="/player/:playerId/relationship" element={<Relationship />} />
              <Route path="/player/:playerId?" element={<Player canContribute={authState.canContribute} />} />
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
