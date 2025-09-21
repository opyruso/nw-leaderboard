import { LangContext } from '../i18n.js';

export default function Register() {
  const { t } = React.useContext(LangContext);
  const [form, setForm] = React.useState({
    username: '',
    email: '',
    password: '',
  });
  const [status, setStatus] = React.useState('idle');
  const [message, setMessage] = React.useState('');

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(
        `${window.CONFIG['nwleaderboard-api-url']}/user/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: form.username,
            email: form.email,
            password: form.password,
          }),
        }
      );

      let payload = {};
      try {
        payload = await response.json();
      } catch (error) {
        payload = {};
      }

      if (!response.ok) {
        let feedback = t.registerError;
        if (response.status === 400) {
          feedback = t.registerValidationError;
        } else if (response.status === 409) {
          if (payload && payload.code === 11) {
            feedback = t.registerUsernameTaken;
          } else if (payload && payload.code === 21) {
            feedback = t.registerEmailTaken;
          } else {
            feedback = t.registerValidationError;
          }
        }
        setStatus('error');
        setMessage(feedback);
        return;
      }

      setStatus('success');
      setMessage(t.registerSuccess);
      setForm({ username: '', email: '', password: '' });
    } catch (error) {
      console.error('Unable to register user', error);
      setStatus('error');
      setMessage(t.registerError);
    }
  };

  return (
    <main className="page" aria-labelledby="register-title">
      <h1 id="register-title" className="page-title">
        {t.register}
      </h1>
      <p className="page-description">{t.registerDescription}</p>
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
          <span>{t.email}</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            autoComplete="email"
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
            autoComplete="new-password"
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? '…' : t.registerAction}
          </button>
        </div>
      </form>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
    </main>
  );
}
