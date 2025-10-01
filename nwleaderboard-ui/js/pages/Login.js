import { LangContext } from '../i18n.js';
import { loginWithPassword } from '../auth.js';

const { Link } = ReactRouterDOM;

const LANGUAGE_ORDER = ['en', 'fr', 'de', 'es', 'esmx', 'it', 'pl', 'pt'];

export default function Login({ onLogin }) {
  const { t, lang, changeLang } = React.useContext(LangContext);
  const [form, setForm] = React.useState({
    username: '',
    password: '',
    remember: true,
  });
  const [status, setStatus] = React.useState('idle');
  const [message, setMessage] = React.useState('');

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const preventCopyPaste = (event) => {
    event.preventDefault();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const tokens = await loginWithPassword(
        form.username,
        form.password,
        form.remember
      );
      if (!tokens || !tokens.access_token) {
        throw new Error('invalid payload');
      }
      onLogin(tokens, form.remember);
      setStatus('success');
    } catch (error) {
      console.warn('Login failed, staying offline', error);
      const status = error && typeof error.status === 'number' ? error.status : null;
      setStatus('error');
      const invalidCredentials = status === 400 || status === 401;
      setMessage(invalidCredentials ? t.loginInvalid : t.loginError);
    }
  };

  return (
    <main className="page" aria-labelledby="login-title">
      <h1 id="login-title" className="page-title">
        {t.gameName}
      </h1>
      <p className="page-description">{t.loginDescription}</p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field form-field-floating">
          <input
            name="username"
            type="text"
            value={form.username}
            onChange={updateField}
            autoComplete="username"
            placeholder=" "
            required
          />
          <span>{t.username}</span>
        </label>
        <label className="form-field form-field-floating">
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            autoComplete="current-password"
            onCopy={preventCopyPaste}
            onCut={preventCopyPaste}
            onPaste={preventCopyPaste}
            placeholder=" "
            required
          />
          <span>{t.passwordLabel}</span>
        </label>
        <label className="form-checkbox">
          <input
            name="remember"
            type="checkbox"
            checked={form.remember}
            onChange={updateField}
          />
          <span>{t.rememberMe}</span>
        </label>
        <div className="form-actions">
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? '…' : t.loginAction}
          </button>
          <Link className="form-action-link secondary" to="/register">
            {t.register}
          </Link>
          <Link className="form-action-link secondary" to="/forgot-password">
            {t.forgotPassword}
          </Link>
        </div>
      </form>
      <div className="form-footer">
        <label className="form-field">
          <span>{t.language}</span>
          <select
            value={lang}
            onChange={(event) => changeLang(event.target.value)}
          >
            {LANGUAGE_ORDER.map((code) => (
              <option key={code} value={code}>
                {t.languageOptions?.[code] || code}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
    </main>
  );
}
