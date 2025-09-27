import { LangContext } from '../i18n.js';
import { ThemeContext } from '../theme.js';

const { useNavigate } = ReactRouterDOM;

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'esmx', label: 'Español (México)' },
  { value: 'it', label: 'Italiano' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt', label: 'Português' },
];

export default function Preferences({ isAuthenticated = false }) {
  const { t, lang, changeLang } = React.useContext(LangContext);
  const { theme, setTheme } = React.useContext(ThemeContext);
  const [messageKey, setMessageKey] = React.useState('');
  const navigate = useNavigate();

  const handleLanguageChange = (event) => {
    const nextLang = event.target.value;
    if (nextLang !== lang) {
      changeLang(nextLang);
      setMessageKey('preferencesSaved');
    }
  };

  const handleThemeChange = (event) => {
    const nextTheme = event.target.value === '1' ? 'dark' : 'light';
    if (nextTheme !== theme) {
      setTheme(nextTheme);
      setMessageKey('preferencesSaved');
    }
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
        <label className="form-field" htmlFor="language-select">
          <span>{t.language}</span>
          <select
            id="language-select"
            value={lang}
            onChange={handleLanguageChange}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-slider">
          <label htmlFor="theme-slider">{t.theme}</label>
          <div className="theme-slider">
            <span aria-hidden="true">{t.themeLight}</span>
            <input
              id="theme-slider"
              type="range"
              min="0"
              max="1"
              step="1"
              value={theme === 'dark' ? '1' : '0'}
              onChange={handleThemeChange}
              aria-valuetext={theme === 'dark' ? t.themeDark : t.themeLight}
            />
            <span aria-hidden="true">{t.themeDark}</span>
          </div>
        </div>
        {isAuthenticated ? (
          <div className="form-actions">
            <button type="button" onClick={goToPasswordPage}>
              {t.password}
            </button>
          </div>
        ) : null}
      </section>
      {messageKey ? (
        <p className="form-message">{t[messageKey]}</p>
      ) : null}
    </main>
  );
}
