import { LangContext } from '../i18n.js';

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const AUTO_DISMISS_MS = 30_000;
const HIDE_TRANSITION_MS = 400;

export default function AnnouncementPopup() {
  const { lang, t } = React.useContext(LangContext);
  const [announcements, setAnnouncements] = React.useState([]);
  const [render, setRender] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const hideTimerRef = React.useRef(null);
  const removeTimerRef = React.useRef(null);
  const dismissedRef = React.useRef(false);

  React.useEffect(() => {
    if (!API_BASE_URL || dismissedRef.current) {
      return () => {};
    }
    let active = true;
    fetch(`${API_BASE_URL}/announcements`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load announcements');
        }
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        const filtered = list.filter((item) => Boolean(item?.id));
        if (filtered.length > 0) {
          setAnnouncements(filtered);
          setRender(true);
          setClosing(false);
        }
      })
      .catch((error) => {
        console.error('Unable to load active announcements', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const scheduleHide = React.useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      dismissedRef.current = true;
      setClosing(true);
    }, AUTO_DISMISS_MS);
  }, []);

  React.useEffect(() => {
    if (render && !closing) {
      scheduleHide();
    }
    return () => {
      window.clearTimeout(hideTimerRef.current);
    };
  }, [render, closing, scheduleHide]);

  React.useEffect(() => {
    if (closing && render) {
      window.clearTimeout(removeTimerRef.current);
      removeTimerRef.current = window.setTimeout(() => {
        setRender(false);
      }, HIDE_TRANSITION_MS);
    }
    return () => {
      window.clearTimeout(removeTimerRef.current);
    };
  }, [closing, render]);

  const handleClose = () => {
    dismissedRef.current = true;
    setClosing(true);
  };

  React.useEffect(() => () => {
    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(removeTimerRef.current);
  }, []);

  if (!render || announcements.length === 0) {
    return null;
  }

  const contentKey = `content_${lang}`;
  const fallbackKey = 'content_en';
  const closeLabel = t.announcementsPopupClose || 'Close announcements';

  const visibleEntries = announcements
    .map((item) => {
      const content = (item?.[contentKey] || '').trim() || (item?.[fallbackKey] || '').trim();
      if (!content) {
        return null;
      }
      return { ...item, content };
    })
    .filter(Boolean);

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <div className={`announcement-popup${closing ? ' announcement-popup--closing' : ''}`}>
      <div className="announcement-popup__content">
        <div className="announcement-popup__header">
          <strong className="announcement-popup__title">
            {t.announcementsPopupTitle || 'Announcement'}
          </strong>
          <button
            type="button"
            className="announcement-popup__close"
            onClick={handleClose}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
        <div className="announcement-popup__body">
          {visibleEntries.map((item) => (
            <article key={item.id} className="announcement-popup__entry">
              {item.title ? (
                <h2 className="announcement-popup__entry-title">{item.title}</h2>
              ) : null}
              <p className="announcement-popup__entry-content">{item.content}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
