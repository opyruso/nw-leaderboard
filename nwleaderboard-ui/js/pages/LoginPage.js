import { LangContext } from '../i18n.js';

export default function LoginPage({ onLogin }) {
  const { t } = React.useContext(LangContext);
  return (
    <div className="login-page">
      <h1 className="login-title login-page-title">{t.gameName}</h1>
      <button onClick={onLogin}>{t.login}</button>
    </div>
  );
}
