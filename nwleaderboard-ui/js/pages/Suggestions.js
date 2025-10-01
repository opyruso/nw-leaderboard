import { LangContext } from '../i18n.js';

const DISCORD_INVITE_URL = 'https://discord.gg/zUnS4T5wBb';

export default function Suggestions() {
  const { t } = React.useContext(LangContext);

  return (
    <main className="page suggestion-page" aria-labelledby="suggestion-title">
      <h1 id="suggestion-title" className="page-title">
        {t.suggestionsDiscordTitle}
      </h1>
      <p className="page-description">{t.suggestionsDiscordDescription}</p>
      <a
        className="suggestion-discord-link"
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noreferrer noopener"
      >
        {t.suggestionsDiscordCTA}
      </a>
    </main>
  );
}
