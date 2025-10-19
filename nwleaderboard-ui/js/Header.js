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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [brandRendered, setBrandRendered] = React.useState(true);
  const [brandVisible, setBrandVisible] = React.useState(true);
  const brandTransitionTimeoutRef = React.useRef(null);
  const brandRevealFrameRef = React.useRef(null);
  const isAuthenticated = Boolean(authenticated);
  const showContribute = isAuthenticated && Boolean(canContribute);
  const contributeActive = location.pathname.startsWith('/contribute');
  const leaderboardActive =
    location.pathname.startsWith('/score') ||
    location.pathname.startsWith('/time') ||
    location.pathname.startsWith('/individual');
  const customCharactersActive = location.pathname.startsWith('/custom-characters');

  const closeMenus = React.useCallback(() => {
    setOpenMenu(null);
    setMobileMenuOpen(false);
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

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => {};
    }

    const mediaQuery = window.matchMedia('(max-width: 960px)');
    const handleChange = () => {
      if (!mediaQuery.matches) {
        setMobileMenuOpen(false);
      }
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

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
  }, [updateHeaderHeight, isScrolled, brandRendered]);

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
    window.clearTimeout(brandTransitionTimeoutRef.current);
    window.cancelAnimationFrame(brandRevealFrameRef.current);

    if (!isScrolled) {
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
  }, [isScrolled]);

  React.useEffect(() => {
    if (!showContribute && openMenu === 'contribute') {
      setOpenMenu(null);
    }
  }, [showContribute, openMenu]);

  React.useEffect(() => {
    closeMenus();
  }, [location.pathname, closeMenus]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return () => {};
    }

    document.body.classList.toggle('has-mobile-nav-open', mobileMenuOpen);

    return () => {
      document.body.classList.remove('has-mobile-nav-open');
    };
  }, [mobileMenuOpen]);

  React.useEffect(() => {
    if (!mobileMenuOpen) {
      return () => {};
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen, closeMenus]);

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
  const navMenuLabel = t.navMenu || 'Navigation menu';
  const toggleLabel = mobileMenuOpen
    ? t.closeMenu || t.closeNavigation || `Close ${navMenuLabel}`
    : t.openMenu || t.openNavigation || `Open ${navMenuLabel}`;

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeMenus();
    }
  };

  const handleToggleClick = () => {
    setOpenMenu(null);
    setMobileMenuOpen((current) => !current);
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
        <button
          type="button"
          className={classNames(
            'site-header__toggle',
            mobileMenuOpen ? 'site-header__toggle--open' : '',
          )}
          aria-expanded={mobileMenuOpen ? 'true' : 'false'}
          aria-controls="site-navigation"
          onClick={handleToggleClick}
        >
          <span className="visually-hidden">{toggleLabel}</span>
          <span aria-hidden="true" />
        </button>
        <nav
          id="site-navigation"
          className={classNames('site-nav', mobileMenuOpen ? 'site-nav--mobile-open' : '')}
          aria-label={navMenuLabel}
        >
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
              {isAuthenticated ? (
                <li className="site-nav__item">
                  <SiteNavLink
                    to="/custom-characters"
                    isActiveOverride={customCharactersActive}
                    aria-current={customCharactersActive ? 'page' : undefined}
                    onClick={closeMenus}
                  >
                    {t.customCharacters || 'Custom characters'}
                  </SiteNavLink>
                </li>
              ) : null}
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
      <div
        className={classNames(
          'site-nav__backdrop',
          mobileMenuOpen ? 'site-nav__backdrop--visible' : '',
        )}
        onClick={closeMenus}
        aria-hidden="true"
      />
    </header>
  );
}
