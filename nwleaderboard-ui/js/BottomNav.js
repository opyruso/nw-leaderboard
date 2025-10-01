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

export default function BottomNav({ authenticated, canContribute = false, onLogout }) {
  const { t } = React.useContext(LangContext);
  const isAuthenticated = Boolean(authenticated);
  const showContribute = isAuthenticated && Boolean(canContribute);

  const accountNavigation = isAuthenticated ? (
    <>
      {showContribute ? <NavButton to="/contribute">{t.contribute}</NavButton> : null}
      <NavButton to="/preferences">{t.preferences}</NavButton>
      <NavButton onClick={onLogout}>{t.logout}</NavButton>
    </>
  ) : (
    <>
      <NavButton to="/preferences">{t.preferences}</NavButton>
      <NavButton to="/login">{t.login}</NavButton>
    </>
  );

  return (
    <nav className="bottom-nav" aria-label={t.navMenu}>
      <NavButton to="/">{t.home}</NavButton>
      {accountNavigation}
    </nav>
  );
}
