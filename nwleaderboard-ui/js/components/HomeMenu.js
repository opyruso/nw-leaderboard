import { LangContext } from '../i18n.js';

const { NavLink } = ReactRouterDOM;

export default function HomeMenu() {
  const { t } = React.useContext(LangContext);
  const highlightsLabel = t.highlights || t.leaderboardTitle;

  return (
    <nav className="home-menu" aria-label={t.leaderboardMenuTitle}>
      <NavLink className={({ isActive }) => (isActive ? 'home-menu-link active' : 'home-menu-link')} to="/" end>
        {highlightsLabel}
      </NavLink>
      <NavLink className={({ isActive }) => (isActive ? 'home-menu-link active' : 'home-menu-link')} to="/score">
        {t.score}
      </NavLink>
      <NavLink className={({ isActive }) => (isActive ? 'home-menu-link active' : 'home-menu-link')} to="/time">
        {t.time}
      </NavLink>
      <NavLink
        className={({ isActive }) => (isActive ? 'home-menu-link active' : 'home-menu-link')}
        to="/individual"
      >
        {t.individual}
      </NavLink>
    </nav>
  );
}

