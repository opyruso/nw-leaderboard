import { LangContext } from '../i18n.js';

const { NavLink } = ReactRouterDOM;

export default function HomeMenu() {
  const { t } = React.useContext(LangContext);
  const highlightsLabel = t.highlights || t.leaderboardTitle;

  return (
    <nav className="page-submenu" aria-label={t.leaderboardMenuTitle}>
      <NavLink
        className={({ isActive }) => (isActive ? 'page-submenu-link active' : 'page-submenu-link')}
        to="/"
        end
      >
        {highlightsLabel}
      </NavLink>
      <NavLink
        className={({ isActive }) => (isActive ? 'page-submenu-link active' : 'page-submenu-link')}
        to="/score"
      >
        {t.score}
      </NavLink>
      <NavLink
        className={({ isActive }) => (isActive ? 'page-submenu-link active' : 'page-submenu-link')}
        to="/time"
      >
        {t.time}
      </NavLink>
      <NavLink
        className={({ isActive }) => (isActive ? 'page-submenu-link active' : 'page-submenu-link')}
        to="/individual"
      >
        {t.individual}
      </NavLink>
    </nav>
  );
}

