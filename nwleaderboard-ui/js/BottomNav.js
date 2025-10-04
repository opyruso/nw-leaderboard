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
  const navRef = React.useRef(null);

  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const updateHeight = () => {
      if (!navRef.current) {
        return;
      }
      const computed = window.getComputedStyle(navRef.current);
      const isHidden = computed.display === 'none' || computed.visibility === 'hidden';
      const height = isHidden ? 0 : navRef.current.offsetHeight;
      document.documentElement.style.setProperty('--bottom-nav-height', `${height}px`);
    };

    updateHeight();

    window.addEventListener('resize', updateHeight);

    let resizeObserver;
    if (navRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(navRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      document.documentElement.style.setProperty('--bottom-nav-height', '0px');
    };
  }, [authenticated, canContribute]);

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
    <nav ref={navRef} className="bottom-nav" aria-label={t.navMenu}>
      <NavButton to="/">{t.home}</NavButton>
      {accountNavigation}
    </nav>
  );
}
