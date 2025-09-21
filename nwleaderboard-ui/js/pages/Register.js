import { LangContext } from '../i18n.js';

export default function Register() {
  const { t } = React.useContext(LangContext);

  const openPortal = () => {
    window.open(`${window.CONFIG['nwleaderboard-api-url']}/portal/register`, '_blank');
  };

  return (
    <main className="page" aria-labelledby="register-title">
      <h1 id="register-title" className="page-title">
        {t.register}
      </h1>
      <p className="page-description">{t.registerDescription}</p>
      <div className="form-actions">
        <button type="button" onClick={openPortal}>
          {t.registerAction}
        </button>
      </div>
    </main>
  );
}
