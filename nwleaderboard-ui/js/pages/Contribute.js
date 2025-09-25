import { LangContext } from '../i18n.js';
import PageSubmenu from '../components/PageSubmenu.js';

const { NavLink, Outlet, useLocation } = ReactRouterDOM;

export default function Contribute() {
  const { t } = React.useContext(LangContext);
  const menuLabel = t.contributeMenuLabel || t.leaderboardMenuTitle;
  const location = useLocation();
  const isValidateRoute = location?.pathname?.startsWith('/contribute/validate');
  const pageClassName = `page contribute-page${isValidateRoute ? ' contribute-page--wide' : ''}`;

  return (
    <main className={pageClassName} aria-labelledby="contribute-title">
      <h1 id="contribute-title" className="page-title">
        {t.contributeTitle}
      </h1>
      <PageSubmenu aria-label={menuLabel}>
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
        <NavLink
          to="/contribute/validate"
          className={({ isActive }) =>
            isActive ? 'page-submenu-link active' : 'page-submenu-link'
          }
        >
          {t.contributeMenuValidate || 'Validate'}
        </NavLink>
        <NavLink
          to="/contribute/stats"
          className={({ isActive }) =>
            isActive ? 'page-submenu-link active' : 'page-submenu-link'
          }
        >
          {t.contributeMenuStats || 'Weekly runs'}
        </NavLink>
        <NavLink
          to="/contribute/players"
          className={({ isActive }) =>
            isActive ? 'page-submenu-link active' : 'page-submenu-link'
          }
        >
          {t.contributeMenuPlayers || t.contributePlayers || 'Players'}
        </NavLink>
      </PageSubmenu>
      <Outlet />
    </main>
  );
}
