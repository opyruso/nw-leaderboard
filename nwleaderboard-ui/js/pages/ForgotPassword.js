import { LangContext } from '../i18n.js';

export default function ForgotPassword() {
  const { t } = React.useContext(LangContext);

  const openReset = () => {
    window.open(`${window.CONFIG['nwleaderboard-api-url']}/portal/reset-password`, '_blank');
  };

  return (
    <main className="page" aria-labelledby="forgot-title">
      <h1 id="forgot-title" className="page-title">
        {t.forgotPassword}
      </h1>
      <p className="page-description">{t.forgotDescription}</p>
      <div className="form-actions">
        <button type="button" onClick={openReset}>
          {t.forgotAction}
        </button>
      </div>
    </main>
  );
}
