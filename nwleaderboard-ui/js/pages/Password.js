import { LangContext } from '../i18n.js';

export default function Password() {
  const { t } = React.useContext(LangContext);

  const openAccount = () => {
    const baseUrl = window.CONFIG['auth-url'] || '';
    const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const realm = window.CONFIG['auth-realm'];
    const accountUrl = `${trimmedBase}/realms/${realm}/account`;
    window.open(accountUrl, '_blank', 'noopener');
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
