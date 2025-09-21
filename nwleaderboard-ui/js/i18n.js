import en from './locales/en.js';
import fr from './locales/fr.js';

const translations = { en, fr };

const LangContext = React.createContext();

function LangProvider({ children }) {
  const [lang, setLang] = React.useState(localStorage.getItem('lang') || 'en');

  const changeLang = (l) => {
    localStorage.setItem('lang', l);
    setLang(l);
  };

  const t = translations[lang];

  return React.createElement(
    LangContext.Provider,
    { value: { lang, changeLang, t } },
    children
  );
}

export { LangContext, LangProvider };
