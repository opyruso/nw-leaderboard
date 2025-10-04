import { LangContext } from './i18n.js';

const { NavLink } = ReactRouterDOM;

function NavButton({ to, children, onClick, end = true }) {
  if (to) {
    return (
      <NavLink className="bottom-nav-link" to={to} end={end}>
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

  const primaryNavigation = React.useMemo(
    () => [
      { to: '/', label: t.home, end: true },
      { to: '/score', label: t.score, end: true },
      { to: '/time', label: t.time, end: true },
      { to: '/individual', label: t.individual, end: true },
      { to: '/player', label: t.players || t.player, end: false },
    ],
    [t],
  );

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
      <div className="bottom-nav__scroll">
        {primaryNavigation.map((item) => (
          <NavButton key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavButton>
        ))}
      </div>
      {accountNavigation}
    </nav>
  );
}
