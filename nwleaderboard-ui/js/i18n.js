import de from './locales/de.js';
import en from './locales/en.js';
import es from './locales/es.js';
import esmx from './locales/esmx.js';
import fr from './locales/fr.js';
import it from './locales/it.js';
import pl from './locales/pl.js';
import pt from './locales/pt.js';

const translations = { en, fr, de, es, esmx, it, pl, pt };

function toDocumentLang(value) {
  if (value === 'esmx') {
    return 'es-MX';
  }
  return value || 'en';
}

function ensureLang(value) {
  return Object.prototype.hasOwnProperty.call(translations, value) ? value : 'en';
}

const LangContext = React.createContext({
  lang: 'en',
  changeLang: () => {},
  t: en,
});

function LangProvider({ children }) {
  const [lang, setLang] = React.useState(() => {
    const stored = localStorage.getItem('lang');
    return ensureLang(stored || 'en');
  });

  React.useEffect(() => {
    document.documentElement.lang = toDocumentLang(lang);
  }, [lang]);

  const changeLang = React.useCallback((nextLang) => {
    const safeLang = ensureLang(nextLang);
    localStorage.setItem('lang', safeLang);
    setLang(safeLang);
  }, []);

  const value = React.useMemo(
    () => ({
      lang,
      changeLang,
      t: translations[lang] || en,
    }),
    [lang, changeLang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export { LangContext, LangProvider };
