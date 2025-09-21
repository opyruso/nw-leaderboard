import { LangContext } from '../i18n.js';

export default function Password() {
  const { t } = React.useContext(LangContext);

  const openAccount = () => {
    window.open(`${window.CONFIG['nwleaderboard-api-url']}/portal/account`, '_blank');
  };

  return (
    <main className="page" aria-labelledby="password-title">
      <h1 id="password-title" className="page-title">
        {t.password}
      </h1>
      <p className="page-description">{t.passwordDescription}</p>
      <div className="form-actions">
        <button type="button" onClick={openAccount}>
          {t.passwordAction}
        </button>
      </div>
    </main>
  );
}
