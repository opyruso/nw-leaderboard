import { LangContext } from '../i18n.js';
import { ThemeContext } from '../theme.js';

const { useNavigate } = ReactRouterDOM;

export default function Preferences() {
  const { t, lang, changeLang } = React.useContext(LangContext);
  const { theme, toggleTheme } = React.useContext(ThemeContext);
  const [messageKey, setMessageKey] = React.useState('');
  const navigate = useNavigate();

  const handleLanguageChange = (event) => {
    changeLang(event.target.value);
    setMessageKey('preferencesSaved');
  };

  const handleThemeChange = () => {
    toggleTheme();
    setMessageKey('preferencesSaved');
  };

  const goToPasswordPage = () => {
    navigate('/password');
  };

  return (
    <main className="page" aria-labelledby="preferences-title">
      <h1 id="preferences-title" className="page-title">
        {t.preferences}
      </h1>
      <p className="page-description">{t.preferencesDescription}</p>
      <section className="form">
        <label className="form-field">
          <span>{t.language}</span>
          <select value={lang} onChange={handleLanguageChange}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
        <div className="form-checkbox">
          <span>{t.theme}</span>
          <button type="button" onClick={handleThemeChange}>
            {t.themeToggle} ({theme === 'dark' ? t.themeDark : t.themeLight})
          </button>
        </div>
        <div className="form-actions">
          <button type="button" onClick={goToPasswordPage}>
            {t.password}
          </button>
        </div>
      </section>
      {messageKey ? (
        <p className="form-message">{t[messageKey]}</p>
      ) : null}
    </main>
  );
}
