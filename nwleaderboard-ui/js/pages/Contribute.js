import { LangContext } from '../i18n.js';
const { Outlet, useLocation } = ReactRouterDOM;

export default function Contribute() {
  const { t } = React.useContext(LangContext);
  const location = useLocation();
  const isValidateRoute = location?.pathname?.startsWith('/contribute/validate');
  const pageClassName = `page contribute-page${isValidateRoute ? ' contribute-page--wide' : ''}`;

  return (
    <main className={pageClassName} aria-labelledby="contribute-title">
      <h1 id="contribute-title" className="page-title">
        {t.contributeTitle}
      </h1>
      <Outlet />
    </main>
  );
}
