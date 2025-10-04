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

const BRAND_TRANSITION_DURATION_MS = 240;

export default function Header({ authenticated, canContribute = false, onLogout }) {
  const { t } = React.useContext(LangContext);
  const location = useLocation();
  const headerRef = React.useRef(null);
  const [openMenu, setOpenMenu] = React.useState(null);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [brandRendered, setBrandRendered] = React.useState(true);
  const [brandVisible, setBrandVisible] = React.useState(true);
  const [isMobileNavigation, setIsMobileNavigation] = React.useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(max-width: 960px)').matches;
  });
  const brandTransitionTimeoutRef = React.useRef(null);
  const brandRevealFrameRef = React.useRef(null);
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

  const updateHeaderHeight = React.useCallback(() => {
    if (headerRef.current) {
      document.documentElement.style.setProperty(
        '--site-header-height',
        `${headerRef.current.offsetHeight}px`,
      );
    }
  }, []);

  React.useLayoutEffect(() => {
    updateHeaderHeight();
  }, [updateHeaderHeight, isScrolled, brandRendered, isMobileNavigation]);

  React.useLayoutEffect(() => {
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [updateHeaderHeight]);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mediaQuery = window.matchMedia('(max-width: 960px)');
    const handleMediaChange = (event) => {
      setIsMobileNavigation(event.matches);
    };

    handleMediaChange(mediaQuery);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);
      return () => {
        mediaQuery.removeEventListener('change', handleMediaChange);
      };
    }

    mediaQuery.addListener(handleMediaChange);
    return () => {
      mediaQuery.removeListener(handleMediaChange);
    };
  }, []);

  React.useEffect(() => {
    window.clearTimeout(brandTransitionTimeoutRef.current);
    window.cancelAnimationFrame(brandRevealFrameRef.current);

    if (isMobileNavigation || !isScrolled) {
      setBrandRendered(true);
      brandRevealFrameRef.current = window.requestAnimationFrame(() => {
        setBrandVisible(true);
      });
    } else {
      setBrandVisible(false);
      brandTransitionTimeoutRef.current = window.setTimeout(() => {
        setBrandRendered(false);
      }, BRAND_TRANSITION_DURATION_MS);
    }

    return () => {
      window.clearTimeout(brandTransitionTimeoutRef.current);
      window.cancelAnimationFrame(brandRevealFrameRef.current);
    };
  }, [isScrolled, isMobileNavigation]);

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
    <header
      ref={headerRef}
      className={classNames('site-header', isScrolled ? 'site-header--compact' : '')}
      onKeyDown={handleMenuKeyDown}
    >
      <div className="site-header__inner">
        {brandRendered ? (
          <div
            className={classNames(
              'site-header__brand',
              brandVisible ? '' : 'site-header__brand--hidden',
            )}
            aria-hidden={!brandVisible}
          >
            <img
              className="site-header__logo"
              src="/images/icons/icon-512.png"
              alt={t.gameName || 'New World Leaderboard'}
              width="56"
              height="56"
            />
            <span className="site-header__title">{t.siteTitle || 'NWLeaderboard - PvE By oPy'}</span>
          </div>
        ) : null}
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
                    <li className="site-nav__dropdown-section">
                      <p className="site-nav__dropdown-title">{t.contributeMenuOrganisation}</p>
                      <ul
                        className="site-nav__dropdown-submenu"
                        aria-label={t.contributeMenuOrganisation}
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
                            to="/contribute/seasons"
                            className="site-nav__sublink"
                            onClick={closeMenus}
                          >
                            {t.contributeMenuSeasons}
                          </SiteNavLink>
                        </li>
                      </ul>
                    </li>
                    <li className="site-nav__dropdown-section">
                      <p className="site-nav__dropdown-title">{t.contributeMenuData}</p>
                      <ul className="site-nav__dropdown-submenu" aria-label={t.contributeMenuData}>
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
                            to="/contribute/runs"
                            className="site-nav__sublink"
                            onClick={closeMenus}
                          >
                            {t.contributeMenuRuns}
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
              <li className="site-nav__item">
                <SiteNavLink
                  to="/preferences"
                  isActiveOverride={location.pathname.startsWith('/preferences')}
                  onClick={closeMenus}
                >
                  {t.preferences}
                </SiteNavLink>
              </li>
              {isAuthenticated ? (
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
              ) : (
                <li className="site-nav__item">
                  <SiteNavLink
                    to="/login"
                    isActiveOverride={location.pathname.startsWith('/login')}
                    onClick={closeMenus}
                  >
                    {t.login}
                  </SiteNavLink>
                </li>
              )}
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}
