import { LangContext } from './i18n.js';

const { NavLink } = ReactRouterDOM;

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

function NavButton({ to, label, icon, onClick }) {
  if (to) {
    return (
      <NavLink
        className={({ isActive }) =>
          `bottom-nav-link${isActive ? ' active' : ''}`
        }
        to={to}
        end
        aria-label={label}
      >
        {icon}
        <span className="bottom-nav-label">{label}</span>
      </NavLink>
    );
  }
  return (
    <button
      type="button"
      className="bottom-nav-button"
      onClick={onClick}
      aria-label={label}
    >
      {icon}
      <span className="bottom-nav-label">{label}</span>
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
      {showContribute ? (
        <NavButton to="/contribute" label={t.contribute} icon={<ContributeIcon />} />
      ) : null}
      <NavButton to="/preferences" label={t.preferences} icon={<PreferencesIcon />} />
      <NavButton onClick={onLogout} label={t.logout} icon={<LogoutIcon />} />
    </>
  ) : (
    <>
      <NavButton to="/preferences" label={t.preferences} icon={<PreferencesIcon />} />
      <NavButton to="/login" label={t.login} icon={<LoginIcon />} />
    </>
  );

  return (
    <nav ref={navRef} className="bottom-nav" aria-label={t.navMenu}>
      <NavButton to="/" label={t.home} icon={<HomeIcon />} />
      {accountNavigation}
    </nav>
  );
}
