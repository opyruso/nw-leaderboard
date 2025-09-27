import { LangContext } from './i18n.js';

const { NavLink, useLocation } = ReactRouterDOM;

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function SiteNavLink({ to, end = false, children, className = '', isActiveOverride, ...rest }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        classNames(
          'site-nav__link',
          className,
          isActiveOverride ?? isActive ? 'site-nav__link--active' : '',
        )
      }
      {...rest}
    >
      {children}
    </NavLink>
  );
}

function SiteNavButton({ onClick, children }) {
  return (
    <button type="button" className="site-nav__link site-nav__link--button" onClick={onClick}>
      {children}
    </button>
  );
}

export default function Header({ authenticated, canContribute = false, onLogout }) {
  const { t } = React.useContext(LangContext);
  const location = useLocation();
  const headerRef = React.useRef(null);
  const [openMenu, setOpenMenu] = React.useState(null);
  const isAuthenticated = Boolean(authenticated);
  const showContribute = isAuthenticated && Boolean(canContribute);
  const contributeActive = location.pathname.startsWith('/contribute');
  const leaderboardActive =
    location.pathname.startsWith('/score') ||
    location.pathname.startsWith('/time') ||
    location.pathname.startsWith('/individual');

  const closeMenus = React.useCallback(() => {
    setOpenMenu(null);
  }, []);

  React.useEffect(() => {
    const handlePointerDown = (event) => {
      if (!headerRef.current || headerRef.current.contains(event.target)) {
        return;
      }
      closeMenus();
    };

    const handleFocusIn = (event) => {
      if (!headerRef.current || headerRef.current.contains(event.target)) {
        return;
      }
      closeMenus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [closeMenus]);

  React.useLayoutEffect(() => {
    function updateHeaderHeight() {
      if (headerRef.current) {
        document.documentElement.style.setProperty(
          '--site-header-height',
          `${headerRef.current.offsetHeight}px`,
        );
      }
    }

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  React.useEffect(() => {
    if (!showContribute && openMenu === 'contribute') {
      setOpenMenu(null);
    }
  }, [showContribute, openMenu]);

  React.useEffect(() => {
    closeMenus();
  }, [location.pathname, closeMenus]);

  const createMenuHandlers = (menuKey) => ({
    onMouseEnter: () => setOpenMenu(menuKey),
    onMouseLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpenMenu((current) => (current === menuKey ? null : current));
      }
    },
    onFocus: () => setOpenMenu(menuKey),
    onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpenMenu((current) => (current === menuKey ? null : current));
      }
    },
  });

  const homeLabel = t.highlights ? `${t.home} (${t.highlights})` : t.home;
  const contributeMenuOpen = openMenu === 'contribute';
  const leaderboardMenuOpen = openMenu === 'leaderboard';

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeMenus();
    }
  };

  return (
    <header ref={headerRef} className="site-header" onKeyDown={handleMenuKeyDown}>
      <div className="site-header__inner">
        <div className="site-header__brand">
          <img
            className="site-header__logo"
            src="images/icons/logo.svg"
            alt={t.gameName || 'New World Leaderboard'}
            width="56"
            height="56"
          />
          <span className="site-header__title">
            New World Stats By oPy - PvE Forever!
          </span>
        </div>
        <nav className="site-nav" aria-label={t.navMenu}>
          <div className="site-nav__sections">
            <ul className="site-nav__group site-nav__group--left">
              <li className="site-nav__item">
                <SiteNavLink to="/" end onClick={closeMenus}>
                  {homeLabel}
                </SiteNavLink>
              </li>
              {showContribute ? (
                <li
                  className={classNames(
                    'site-nav__item',
                    'site-nav__item--dropdown',
                    contributeMenuOpen ? 'site-nav__item--open' : '',
                  )}
                  {...createMenuHandlers('contribute')}
                >
                  <SiteNavLink
                    to="/contribute"
                    className="site-nav__link--parent"
                    isActiveOverride={contributeActive}
                    aria-haspopup="true"
                    aria-expanded={contributeMenuOpen ? 'true' : 'false'}
                    onClick={closeMenus}
                  >
                    {t.contribute}
                  </SiteNavLink>
                  <ul
                    className={classNames(
                      'site-nav__dropdown-menu',
                      contributeMenuOpen ? 'site-nav__dropdown-menu--open' : '',
                    )}
                    aria-hidden={contributeMenuOpen ? undefined : 'true'}
                  >
                    <li>
                      <SiteNavLink
                        to="/contribute"
                        className="site-nav__sublink"
                        end
                        onClick={closeMenus}
                      >
                        {t.contributeMenuDungeons}
                      </SiteNavLink>
                    </li>
                    <li>
                      <SiteNavLink
                        to="/contribute/mutations"
                        className="site-nav__sublink"
                        onClick={closeMenus}
                      >
                        {t.contributeMenuMutations}
                      </SiteNavLink>
                    </li>
                    <li>
                      <SiteNavLink
                        to="/contribute/import"
                        className="site-nav__sublink"
                        onClick={closeMenus}
                      >
                        {t.contributeMenuImport}
                      </SiteNavLink>
                    </li>
                    <li>
                      <SiteNavLink
                        to="/contribute/validate"
                        className="site-nav__sublink"
                        onClick={closeMenus}
                      >
                        {t.contributeMenuValidate}
                      </SiteNavLink>
                    </li>
                    <li>
                      <SiteNavLink
                        to="/contribute/stats"
                        className="site-nav__sublink"
                        onClick={closeMenus}
                      >
                        {t.contributeMenuStats}
                      </SiteNavLink>
                    </li>
                    <li>
                      <SiteNavLink
                        to="/contribute/players"
                        className="site-nav__sublink"
                        onClick={closeMenus}
                      >
                        {t.contributeMenuPlayers}
                      </SiteNavLink>
                    </li>
                  </ul>
                </li>
              ) : null}
              <li
                className={classNames(
                  'site-nav__item',
                  'site-nav__item--dropdown',
                  leaderboardMenuOpen ? 'site-nav__item--open' : '',
                )}
                {...createMenuHandlers('leaderboard')}
              >
                <SiteNavLink
                  to="/score"
                  className="site-nav__link--parent"
                  isActiveOverride={leaderboardActive}
                  aria-haspopup="true"
                  aria-expanded={leaderboardMenuOpen ? 'true' : 'false'}
                  aria-current={leaderboardActive ? 'page' : undefined}
                  onClick={closeMenus}
                >
                  {t.leaderboardMenuTitle}
                </SiteNavLink>
                <ul
                  className={classNames(
                    'site-nav__dropdown-menu',
                    leaderboardMenuOpen ? 'site-nav__dropdown-menu--open' : '',
                  )}
                  aria-hidden={leaderboardMenuOpen ? undefined : 'true'}
                >
                  <li>
                    <SiteNavLink
                      to="/score"
                      className="site-nav__sublink"
                      end
                      onClick={closeMenus}
                    >
                      {t.score}
                    </SiteNavLink>
                  </li>
                  <li>
                    <SiteNavLink
                      to="/time"
                      className="site-nav__sublink"
                      end
                      onClick={closeMenus}
                    >
                      {t.time}
                    </SiteNavLink>
                  </li>
                  <li>
                    <SiteNavLink
                      to="/individual"
                      className="site-nav__sublink"
                      end
                      onClick={closeMenus}
                    >
                      {t.individual}
                    </SiteNavLink>
                  </li>
                </ul>
              </li>
              <li className="site-nav__item">
                <SiteNavLink
                  to="/player"
                  isActiveOverride={location.pathname.startsWith('/player')}
                  aria-current={location.pathname.startsWith('/player') ? 'page' : undefined}
                  onClick={closeMenus}
                >
                  {t.players || t.player}
                </SiteNavLink>
              </li>
            </ul>
            <ul className="site-nav__group site-nav__group--right">
              {isAuthenticated ? (
                <>
                  <li className="site-nav__item">
                    <SiteNavLink to="/preferences" isActiveOverride={location.pathname.startsWith('/preferences')}>
                      {t.preferences}
                    </SiteNavLink>
                  </li>
                  <li className="site-nav__item">
                    <SiteNavButton
                      onClick={() => {
                        closeMenus();
                        onLogout();
                      }}
                    >
                      {t.logout}
                    </SiteNavButton>
                  </li>
                </>
              ) : (
                <>
                  <li className="site-nav__item">
                    <SiteNavLink
                      to="/register"
                      isActiveOverride={location.pathname.startsWith('/register')}
                      onClick={closeMenus}
                    >
                      {t.register}
                    </SiteNavLink>
                  </li>
                  <li className="site-nav__item">
                    <SiteNavLink
                      to="/forgot-password"
                      isActiveOverride={location.pathname.startsWith('/forgot-password')}
                      onClick={closeMenus}
                    >
                      {t.forgotPassword}
                    </SiteNavLink>
                  </li>
                  <li className="site-nav__item">
                    <SiteNavLink
                      to="/login"
                      isActiveOverride={location.pathname.startsWith('/login')}
                      onClick={closeMenus}
                    >
                      {t.login}
                    </SiteNavLink>
                  </li>
                </>
              )}
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}
