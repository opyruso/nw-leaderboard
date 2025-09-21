import { LangContext } from './i18n.js';

const { NavLink } = ReactRouterDOM;

function NavButton({ to, children, onClick }) {
  if (to) {
    return (
      <NavLink className="bottom-nav-link" to={to} end>
        {({ isActive }) => (
          <span className={isActive ? 'active' : undefined}>{children}</span>
        )}
      </NavLink>
    );
  }
  return (
    <button type="button" className="bottom-nav-button" onClick={onClick}>
      {children}
    </button>
  );
}

export default function BottomNav({ authenticated, onLogout }) {
  const { t } = React.useContext(LangContext);
  const isAuthenticated = Boolean(authenticated);

  const accountNavigation = isAuthenticated ? (
    <>
      <NavButton to="/preferences">{t.preferences}</NavButton>
      <NavButton to="/password">{t.password}</NavButton>
      <NavButton onClick={onLogout}>{t.logout}</NavButton>
    </>
  ) : (
    <>
      <NavButton to="/login">{t.login}</NavButton>
      <NavButton to="/register">{t.register}</NavButton>
      <NavButton to="/forgot-password">{t.forgotPassword}</NavButton>
    </>
  );

  return (
    <nav className="bottom-nav" aria-label={t.navMenu}>
      <NavButton to="/">{t.home}</NavButton>
      {accountNavigation}
    </nav>
  );
}
