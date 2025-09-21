import { LangContext } from '../i18n.js';

export default function Individual() {
  const { t } = React.useContext(LangContext);

  return (
    <main className="page" aria-labelledby="individual-title">
      <h1 id="individual-title" className="page-title">
        {t.individualTitle}
      </h1>
      <p className="page-description">{t.individualComingSoon}</p>
    </main>
  );
}
