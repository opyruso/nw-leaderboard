import { LangContext } from '../i18n.js';
import { useDocumentTitle } from '../pageTitle.js';

export default function Password() {
  const { t } = React.useContext(LangContext);

  const [form, setForm] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
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

  const preventCopyPaste = (event) => {
    event.preventDefault();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    if (form.newPassword !== form.confirmPassword) {
      setStatus('error');
      setMessage(t.passwordMismatch);
      return;
    }

    try {
      const response = await fetch(
        `${window.CONFIG['nwleaderboard-api-url']}/user/password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword: form.currentPassword,
            newPassword: form.newPassword,
          }),
        }
      );

      if (response.status === 401) {
        setStatus('error');
        setMessage(t.passwordCurrentInvalid);
        return;
      }

      if (!response.ok) {
        throw new Error('password update failed');
      }

      setStatus('success');
      setMessage(t.passwordSuccess);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Unable to update password', error);
      setStatus('error');
      setMessage(t.passwordError);
    }
  };

  useDocumentTitle(t.password);

  return (
    <main className="page" aria-labelledby="password-title">
      <h1 id="password-title" className="page-title">
        {t.password}
      </h1>
      <p className="page-description">{t.passwordDescription}</p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field form-field-floating">
          <input
            name="currentPassword"
            type="password"
            value={form.currentPassword}
            onChange={updateField}
            autoComplete="current-password"
            onCopy={preventCopyPaste}
            onCut={preventCopyPaste}
            onPaste={preventCopyPaste}
            placeholder=" "
            required
          />
          <span>{t.currentPassword}</span>
        </label>
        <label className="form-field form-field-floating">
          <input
            name="newPassword"
            type="password"
            value={form.newPassword}
            onChange={updateField}
            autoComplete="new-password"
            onCopy={preventCopyPaste}
            onCut={preventCopyPaste}
            onPaste={preventCopyPaste}
            placeholder=" "
            required
          />
          <span>{t.newPassword}</span>
        </label>
        <label className="form-field form-field-floating">
          <input
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={updateField}
            autoComplete="new-password"
            onCopy={preventCopyPaste}
            onCut={preventCopyPaste}
            onPaste={preventCopyPaste}
            placeholder=" "
            required
          />
          <span>{t.confirmPassword}</span>
        </label>
        <div className="form-actions">
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? '…' : t.passwordAction}
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
