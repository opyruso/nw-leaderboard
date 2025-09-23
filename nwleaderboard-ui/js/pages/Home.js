import { LangContext } from '../i18n.js';
import HomeMenu from '../components/HomeMenu.js';

export default function Home() {
  const { t } = React.useContext(LangContext);
  const highlights = React.useMemo(
    () => [
      {
        id: 'h1',
        title: 'Expedition: Dynasty Shipyard',
        description: 'New record clear time set by the Marauders guild.',
      },
      {
        id: 'h2',
        title: 'War leaderboard',
        description: 'Everfall defended successfully for the fifth consecutive week.',
      },
    ],
    []
  );

  return (
    <main className="page" aria-labelledby="home-title">
      <h1 id="home-title" className="page-title">
        {t.leaderboardTitle}
      </h1>
      <HomeMenu />
      <ul className="highlight-list">
        {highlights.length === 0 ? (
          <li className="highlight-empty">{t.leaderboardEmpty}</li>
        ) : (
          highlights.map((highlight) => (
            <li key={highlight.id} className="highlight-item">
              <h2>{highlight.title}</h2>
              <p>{highlight.description}</p>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
