import { LangContext } from '../i18n.js';

function buildDemoTokens(username) {
  const issuedAt = Date.now();
  return {
    access_token: `demo-${username || 'player'}-${issuedAt}`,
    token_type: 'Bearer',
    expires_at: issuedAt + 60 * 60 * 1000,
    scope: 'demo',
    demo: true,
  };
}

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch(
        `${window.CONFIG['nwleaderboard-api-url']}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: form.username,
            password: form.password,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('login failed');
      }
      const data = await response.json();
      const tokens = {
        ...data,
        access_token: data.access_token || data.token,
      };
      if (!tokens.access_token) {
        throw new Error('invalid payload');
      }
      onLogin(tokens, form.remember);
      setStatus('success');
    } catch (error) {
      console.warn('Login failed, staying offline', error);
      setStatus('error');
      setMessage(t.loginError);
    }
  };

  const handleDemoLogin = () => {
    const tokens = buildDemoTokens(form.username);
    onLogin(tokens, form.remember);
    setStatus('demo');
    setMessage(t.loginDemoActive);
  };

  return (
    <main className="page" aria-labelledby="login-title">
      <h1 id="login-title" className="page-title">
        {t.gameName}
      </h1>
      <p className="page-description">{t.loginDescription}</p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>{t.username}</span>
          <input
            name="username"
            type="text"
            value={form.username}
            onChange={updateField}
            autoComplete="username"
            required
          />
        </label>
        <label className="form-field">
          <span>{t.passwordLabel}</span>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            autoComplete="current-password"
            required
          />
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
          <button
            type="button"
            className="secondary"
            onClick={handleDemoLogin}
          >
            {t.loginDemo}
          </button>
        </div>
      </form>
      <div className="form-footer">
        <label className="form-field">
          <span>{t.language}</span>
          <select
            value={lang}
            onChange={(event) => changeLang(event.target.value)}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
    </main>
  );
}
