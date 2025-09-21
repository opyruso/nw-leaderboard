import { LangContext } from '../i18n.js';

export default function ForgotPassword() {
  const { t } = React.useContext(LangContext);
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState('idle');
  const [message, setMessage] = React.useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(
        `${window.CONFIG['nwleaderboard-api-url']}/user/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        throw new Error('reset password failed');
      }

      setStatus('success');
      setMessage(t.forgotSuccess);
      setEmail('');
    } catch (error) {
      console.error('Unable to send password reset email', error);
      setStatus('error');
      setMessage(t.forgotError);
    }
  };

  return (
    <main className="page" aria-labelledby="forgot-title">
      <h1 id="forgot-title" className="page-title">
        {t.forgotPassword}
      </h1>
      <p className="page-description">{t.forgotDescription}</p>
      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>{t.email}</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? '…' : t.forgotAction}
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
