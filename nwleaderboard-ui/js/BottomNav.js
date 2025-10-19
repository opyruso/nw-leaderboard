import { LangContext } from './i18n.js';

const { NavLink, useLocation } = ReactRouterDOM;

function HomeIcon() {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 10.75 12 4l7.5 6.75v8.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.25h-3v4.25a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75z"
      />
    </svg>
  );
}

function ContributeIcon() {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 5v14m7-7H5"
      />
    </svg>
  );
}

function PreferencesIcon() {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.5-3.5a1 1 0 0 1-.73.96l-1.3.4a6.53 6.53 0 0 1-.74 1.78l.37 1.34a1 1 0 0 1-.27.97l-1.42 1.42a1 1 0 0 1-.97.27l-1.34-.37a6.52 6.52 0 0 1-1.78.74l-.4 1.3a1 1 0 0 1-.96.73h-2a1 1 0 0 1-.96-.73l-.4-1.3a6.52 6.52 0 0 1-1.78-.74l-1.34.37a1 1 0 0 1-.97-.27L4.43 17a1 1 0 0 1-.27-.97l.37-1.34a6.53 6.53 0 0 1-.74-1.78l-1.3-.4a1 1 0 0 1-.73-.96v-2a1 1 0 0 1 .73-.96l1.3-.4a6.53 6.53 0 0 1 .74-1.78l-.37-1.34a1 1 0 0 1 .27-.97L5.85 4.4a1 1 0 0 1 .97-.27l1.34.37a6.52 6.52 0 0 1 1.78-.74l.4-1.3a1 1 0 0 1 .96-.73h2a1 1 0 0 1 .96.73l.4 1.3a6.52 6.52 0 0 1 1.78.74l1.34-.37a1 1 0 0 1 .97.27l1.42 1.42a1 1 0 0 1 .27.97l-.37 1.34a6.53 6.53 0 0 1 .74 1.78l1.3.4a1 1 0 0 1 .73.96Z"
      />
    </svg>
  );
}

function LeaderboardIcon() {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 20V10m6 10V4m6 16v-7"
      />
    </svg>
  );
}

function PlayersIcon() {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8a7.5 7.5 0 0 1 15 0"
      />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 7V5.5A1.5 1.5 0 0 1 12 4h7a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20H12a1.5 1.5 0 0 1-1.5-1.5V17m-5 0 4-4-4-4m4 4H3"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 7V5.5A1.5 1.5 0 0 0 12 4H5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 5 20h7a1.5 1.5 0 0 0 1.5-1.5V17m5 0-4-4 4-4m-4 4h7"
      />
    </svg>
  );
}

function NavButton({ to, label, icon, onClick, isActive = false, className = '', ...rest }) {
  if (to) {
    return (
      <NavLink
        className={({ isActive }) =>
          `bottom-nav-link${isActive ? ' active' : ''}${className ? ` ${className}` : ''}`
        }
        to={to}
        end
        aria-label={label}
        {...rest}
      >
        {icon}
        <span className="bottom-nav-label">{label}</span>
      </NavLink>
    );
  }
  return (
    <button
      type="button"
      className={`bottom-nav-button${isActive ? ' active' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-label={label}
      {...rest}
    >
      {icon}
      <span className="bottom-nav-label">{label}</span>
    </button>
  );
}

function BottomNavMenu({
  menuKey,
  icon,
  label,
  isOpen,
  onToggle,
  isHighlighted = false,
  children,
}) {
  const panelId = `bottom-nav-menu-${menuKey}`;
  const buttonId = `${panelId}-button`;
  return (
    <div className={`bottom-nav-menu${isOpen ? ' bottom-nav-menu--open' : ''}`}>
      <NavButton
        id={buttonId}
        label={label}
        icon={icon}
        onClick={() => onToggle(menuKey)}
        isActive={isOpen || isHighlighted}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-haspopup="true"
        aria-controls={panelId}
      />
      <div
        id={panelId}
        className="bottom-nav-menu__panel"
        role="menu"
        aria-labelledby={buttonId}
        aria-hidden={isOpen ? undefined : 'true'}
      >
        {children}
      </div>
    </div>
  );
}

function BottomNavMenuLink({ to, label, onClick }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `bottom-nav-menu__link${isActive ? ' active' : ''}`
      }
      onClick={onClick}
      role="menuitem"
    >
      {label}
    </NavLink>
  );
}

export default function BottomNav({ authenticated, canContribute = false, onLogout }) {
  const { t } = React.useContext(LangContext);
  const isAuthenticated = Boolean(authenticated);
  const showContribute = isAuthenticated && Boolean(canContribute);
  const navRef = React.useRef(null);
  const location = useLocation();
  const [openMenu, setOpenMenu] = React.useState(null);
  const contributeActive = location.pathname.startsWith('/contribute');
  const leaderboardActive =
    location.pathname.startsWith('/score') ||
    location.pathname.startsWith('/time') ||
    location.pathname.startsWith('/individual');
  const customCharactersActive = location.pathname.startsWith('/custom-characters');
  const playersActive = location.pathname.startsWith('/player') || customCharactersActive;

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

  const closeMenus = React.useCallback(() => {
    setOpenMenu(null);
  }, []);

  const toggleMenu = React.useCallback((menuKey) => {
    setOpenMenu((current) => (current === menuKey ? null : menuKey));
  }, []);

  React.useEffect(() => {
    closeMenus();
  }, [location.pathname, closeMenus]);

  React.useEffect(() => {
    if (!openMenu) {
      return () => {};
    }

    const handlePointerDown = (event) => {
      if (!navRef.current || navRef.current.contains(event.target)) {
        return;
      }
      closeMenus();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, closeMenus]);

  const accountNavigation = isAuthenticated ? (
    <>
      {showContribute ? (
        <BottomNavMenu
          menuKey="contribute"
          label={t.contribute}
          icon={<ContributeIcon />}
          isOpen={openMenu === 'contribute'}
          onToggle={toggleMenu}
          isHighlighted={contributeActive}
        >
          <div className="bottom-nav-menu__section">
            <p className="bottom-nav-menu__title">{t.contributeMenuOrganisation}</p>
            <div className="bottom-nav-menu__links" role="none">
              <BottomNavMenuLink to="/contribute" label={t.contributeMenuDungeons} onClick={closeMenus} />
              <BottomNavMenuLink
                to="/contribute/mutations"
                label={t.contributeMenuMutations}
                onClick={closeMenus}
              />
              <BottomNavMenuLink
                to="/contribute/seasons"
                label={t.contributeMenuSeasons}
                onClick={closeMenus}
              />
            </div>
          </div>
          <div className="bottom-nav-menu__section">
            <p className="bottom-nav-menu__title">{t.contributeMenuData}</p>
            <div className="bottom-nav-menu__links" role="none">
              <BottomNavMenuLink
                to="/contribute/import"
                label={t.contributeMenuImport}
                onClick={closeMenus}
              />
              <BottomNavMenuLink
                to="/contribute/validate"
                label={t.contributeMenuValidate}
                onClick={closeMenus}
              />
              <BottomNavMenuLink
                to="/contribute/stats"
                label={t.contributeMenuStats}
                onClick={closeMenus}
              />
              <BottomNavMenuLink
                to="/contribute/runs"
                label={t.contributeMenuRuns}
                onClick={closeMenus}
              />
              <BottomNavMenuLink
                to="/contribute/players"
                label={t.contributeMenuPlayers}
                onClick={closeMenus}
              />
            </div>
          </div>
        </BottomNavMenu>
      ) : null}
      <NavButton to="/preferences" label={t.preferences} icon={<PreferencesIcon />} />
      <NavButton
        onClick={() => {
          closeMenus();
          onLogout();
        }}
        label={t.logout}
        icon={<LogoutIcon />}
      />
    </>
  ) : (
    <>
      <NavButton to="/preferences" label={t.preferences} icon={<PreferencesIcon />} />
      <NavButton to="/login" label={t.login} icon={<LoginIcon />} />
    </>
  );

  return (
    <>
      {openMenu ? (
        <div className="bottom-nav-backdrop" onClick={closeMenus} aria-hidden="true" />
      ) : null}
      <nav ref={navRef} className="bottom-nav" aria-label={t.navMenu}>
        <NavButton to="/" label={t.home} icon={<HomeIcon />} />
        <BottomNavMenu
          menuKey="leaderboard"
          label={t.leaderboardMenuTitle}
          icon={<LeaderboardIcon />}
          isOpen={openMenu === 'leaderboard'}
          onToggle={toggleMenu}
          isHighlighted={leaderboardActive}
        >
          <div className="bottom-nav-menu__links" role="none">
            <BottomNavMenuLink to="/score" label={t.score} onClick={closeMenus} />
            <BottomNavMenuLink to="/time" label={t.time} onClick={closeMenus} />
            <BottomNavMenuLink to="/individual" label={t.individual} onClick={closeMenus} />
          </div>
        </BottomNavMenu>
        <BottomNavMenu
          menuKey="players"
          label={t.players || t.player}
          icon={<PlayersIcon />}
          isOpen={openMenu === 'players'}
          onToggle={toggleMenu}
          isHighlighted={playersActive}
        >
          <div className="bottom-nav-menu__links" role="none">
            <BottomNavMenuLink to="/player" label={t.players || t.player} onClick={closeMenus} />
            {isAuthenticated ? (
              <BottomNavMenuLink
                to="/custom-characters"
                label={t.customCharacters || 'Custom characters'}
                onClick={closeMenus}
              />
            ) : null}
          </div>
        </BottomNavMenu>
        {accountNavigation}
      </nav>
    </>
  );
}
