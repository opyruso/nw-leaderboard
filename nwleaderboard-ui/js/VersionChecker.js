import { LangContext } from './i18n.js';

const VERSION_STORAGE_KEY = 'app-version';

function useServiceWorkerMessages(setState) {
  React.useEffect(() => {
    if (!navigator.serviceWorker) return undefined;

    const handler = (event) => {
      const { data } = event;
      if (!data) return;
      if (data === 'CACHE_COMPLETE') {
        setState((prev) => ({ ...prev, cacheMessage: 'complete' }));
      } else if (data.type === 'CACHE_SUMMARY') {
        setState((prev) => ({
          ...prev,
          cacheMessage: {
            success: data.success,
            total: data.total,
          },
        }));
      } else if (data.type === 'CACHE_INIT') {
        setState((prev) => ({ ...prev, cacheMessage: 'init' }));
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [setState]);
}

export default function VersionChecker() {
  const { t } = React.useContext(LangContext);
  const [state, setState] = React.useState({
    status: 'checking',
    version: null,
    cacheMessage: null,
  });

  useServiceWorkerMessages(setState);

  React.useEffect(() => {
    if (state.status !== 'current' || state.cacheMessage !== 'complete') {
      return undefined;
    }

    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.status !== 'current' || prev.cacheMessage !== 'complete') {
          return prev;
        }

        return { ...prev, cacheMessage: null };
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [state.status, state.cacheMessage]);

  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch('/version.txt', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('version fetch failed');
        }
        const version = (await response.text()).trim();
        if (cancelled) return;
        const previous = localStorage.getItem(VERSION_STORAGE_KEY);
        localStorage.setItem(VERSION_STORAGE_KEY, version);
        if (previous && previous !== version) {
          setState({ status: 'outdated', version, cacheMessage: null });
        } else {
          setState({ status: 'current', version, cacheMessage: null });
        }
      } catch (error) {
        console.warn('Unable to retrieve version.txt', error);
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: 'error' }));
        }
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'current' && !state.cacheMessage) {
    return null;
  }

  let message = t.versionChecking;
  if (state.status === 'current') {
    message = t.versionUpToDate;
  } else if (state.status === 'outdated') {
    message = t.versionOutdated;
  } else if (state.status === 'error') {
    message = t.versionError;
  }

  if (state.cacheMessage === 'init') {
    message = t.cachePreparing;
  } else if (state.cacheMessage === 'complete') {
    message = t.cacheComplete;
  } else if (state.cacheMessage && typeof state.cacheMessage === 'object') {
    message = t.cacheSummary(state.cacheMessage.success, state.cacheMessage.total);
  }

  return (
    <div className={`version-banner version-${state.status}`} role="status">
      <span>{message}</span>
      {state.status === 'outdated' ? (
        <button type="button" onClick={() => window.location.reload()}>
          {t.reload}
        </button>
      ) : null}
    </div>
  );
}
