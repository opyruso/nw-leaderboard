import { LangContext } from '../i18n.js';

const { NavLink, Outlet } = ReactRouterDOM;

export default function Contribute() {
  const { t } = React.useContext(LangContext);
  const menuLabel = t.contributeMenuLabel || t.leaderboardMenuTitle;

  return (
    <main className="page contribute-page" aria-labelledby="contribute-title">
      <h1 id="contribute-title" className="page-title">
        {t.contributeTitle}
      </h1>
      <nav className="page-submenu" aria-label={menuLabel}>
        <NavLink
          to="/contribute"
          end
          className={({ isActive }) =>
            isActive ? 'page-submenu-link active' : 'page-submenu-link'
          }
        >
          {t.contributeMenuDungeons || t.dungeons || 'Dungeons'}
        </NavLink>
        <NavLink
          to="/contribute/import"
          className={({ isActive }) =>
            isActive ? 'page-submenu-link active' : 'page-submenu-link'
          }
        >
          {t.contributeMenuImport || t.contribute}
        </NavLink>
      </nav>
      <Outlet />
    </main>
  );
}
