import { LangContext } from '../i18n.js';
import { useDocumentTitle } from '../pageTitle.js';

const { Link } = ReactRouterDOM;

const API_BASE_URL = (window.CONFIG?.['nwleaderboard-api-url'] || '').replace(/\/$/, '');
const EXPECTED_WIDTH = 2560;
const EXPECTED_HEIGHT = 1440;
const IMAGE_PROCESSING_TIMEOUT_MS = 60 * 1000;
const PROCESSING_TIMER_INTERVAL_MS = 1000;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatSecondsFromDuration(milliseconds) {
  if (!isFiniteNumber(milliseconds)) {
    return null;
  }
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${seconds}s`;
}

function toLocaleHeader(lang) {
  if (lang === 'esmx') {
    return 'es-MX';
  }
  return lang || 'en';
}

export default function ContributeImport() {
  const { t, lang } = React.useContext(LangContext);
  const fileInputRef = React.useRef(null);
  const [selectedFiles, setSelectedFiles] = React.useState(() => []);
  const [status, setStatus] = React.useState('idle');
  const [messageKey, setMessageKey] = React.useState('');
  const [messageText, setMessageText] = React.useState('');
  const [errorKey, setErrorKey] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [processingNow, setProcessingNow] = React.useState(() => Date.now());

  const sectionTitle = React.useMemo(() => {
    const section = t.contributeMenuImport || t.contribute || 'Import';
    const base = t.contributeTitle || '';
    return base ? `${base} – ${section}` : section;
  }, [t]);

  useDocumentTitle(sectionTitle);

  const resetFeedback = React.useCallback(() => {
    setMessageKey('');
    setMessageText('');
    setErrorKey('');
    setErrorText('');
  }, []);

  const updateSelectedFile = React.useCallback((id, updater) => {
    setSelectedFiles((current) =>
      current.map((file) => {
        if (file.id !== id) {
          return file;
        }
        const updates = updater(file);
        return { ...file, ...updates };
      }),
    );
  }, []);

  React.useEffect(() => {
    const hasProcessing = selectedFiles.some((file) => file.status === 'processing');
    if (!hasProcessing) {
      return undefined;
    }
    setProcessingNow(Date.now());
    const timerId = window.setInterval(() => {
      setProcessingNow(Date.now());
    }, PROCESSING_TIMER_INTERVAL_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [selectedFiles]);

  const getFileLabel = React.useCallback(
    (file, index) => {
      if (file && typeof file.name === 'string' && file.name.trim()) {
        return file.name;
      }
      if (file && file.file && typeof file.file.name === 'string' && file.file.name.trim()) {
        return file.file.name;
      }
      if (typeof t.contributeImageFallback === 'function') {
        return t.contributeImageFallback(index + 1);
      }
      return `Image ${index + 1}`;
    },
    [t],
  );

  const getFileStatusLabel = React.useCallback(
    (fileStatus) => {
      if (fileStatus === 'processing') {
        return t.contributeFileStatusProcessing || 'Processing';
      }
      if (fileStatus === 'success') {
        return t.contributeFileStatusSuccess || 'Ready';
      }
      if (fileStatus === 'error') {
        return t.contributeFileStatusError || 'Error';
      }
      return t.contributeFileStatusReady || 'Ready';
    },
    [t],
  );

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    resetFeedback();
    if (!files.length) {
      setSelectedFiles([]);
      return;
    }
    const processed = await Promise.all(
      files.map(
        (file, index) =>
          new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
              URL.revokeObjectURL(url);
              resolve({
                id: `${Date.now()}-${index}`,
                file,
                name: file.name,
                width: image.naturalWidth,
                height: image.naturalHeight,
                status: 'ready',
                errorMessage: '',
                processingStartedAt: null,
                processingCompletedAt: null,
                processingDurationMs: null,
              });
            };
            image.onerror = () => {
              URL.revokeObjectURL(url);
              resolve({
                id: `${Date.now()}-${index}`,
                file,
                name: file.name,
                width: 0,
                height: 0,
                status: 'error',
                errorMessage: t.contributeImageLoadError || 'Unable to read image',
                processingStartedAt: null,
                processingCompletedAt: null,
                processingDurationMs: null,
              });
            };
            image.src = url;
          }),
      ),
    );
    const filtered = processed.filter((item) => {
      if (item.status === 'error') {
        return true;
      }
      if (item.width !== EXPECTED_WIDTH || item.height !== EXPECTED_HEIGHT) {
        return false;
      }
      return true;
    });
    const invalidDimensions = processed.filter(
      (item) => item.status !== 'error' && (item.width !== EXPECTED_WIDTH || item.height !== EXPECTED_HEIGHT),
    );
    if (invalidDimensions.length) {
      setErrorKey('contributeInvalidDimensions');
      setErrorText('');
    } else {
      setErrorKey('');
      setErrorText('');
    }
    setSelectedFiles(filtered);
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
    resetFeedback();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExtract = async () => {
    if (!selectedFiles.length || !API_BASE_URL) {
      return;
    }
    resetFeedback();
    setStatus('extracting');
    const filesToProcess = selectedFiles.filter((file) => file.status !== 'processing');
    if (!filesToProcess.length) {
      setStatus('idle');
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    let lastErrorMessage = '';

    for (const file of filesToProcess) {
      const startedAt = Date.now();
      updateSelectedFile(file.id, () => ({
        status: 'processing',
        processingStartedAt: startedAt,
        processingCompletedAt: null,
        processingDurationMs: null,
        errorMessage: '',
      }));

      let requestOk = false;
      let apiMessage = '';
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), IMAGE_PROCESSING_TIMEOUT_MS);
        try {
          const formData = new FormData();
          formData.append('file0', file.file);
          const response = await fetch(`${API_BASE_URL}/contributor/extract`, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept-Language': toLocaleHeader(lang),
            },
            signal: controller.signal,
          });
          requestOk = response.ok;
          if (!response.ok) {
            try {
              const data = await response.json();
              apiMessage = data && data.message ? data.message : '';
            } catch (error) {
              apiMessage = '';
            }
          }
        } finally {
          window.clearTimeout(timeoutId);
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          apiMessage =
            typeof t.contributeProcessingTimeout === 'string'
              ? t.contributeProcessingTimeout
              : 'Processing timed out after 60 seconds.';
        }
      }

      const completedAt = Date.now();
      const durationMs = Math.max(0, completedAt - startedAt);
      updateSelectedFile(file.id, () => ({
        status: requestOk ? 'success' : 'error',
        processingCompletedAt: completedAt,
        processingDurationMs: durationMs,
        errorMessage: requestOk ? '' : apiMessage,
      }));

      if (requestOk) {
        successCount += 1;
      } else {
        failureCount += 1;
        lastErrorMessage = apiMessage || lastErrorMessage;
      }
    }

    if (successCount && !failureCount) {
      setMessageKey('contributeImportStored');
      setMessageText('');
      setErrorKey('');
      setErrorText('');
    } else {
      setMessageKey('');
      setMessageText('');
      if (failureCount) {
        if (lastErrorMessage) {
          setErrorKey('');
          setErrorText(lastErrorMessage);
        } else {
          setErrorKey('contributeError');
          setErrorText('');
        }
      }
    }

    setStatus('idle');
  };

  const resolvedError = errorText || (errorKey && t[errorKey] ? t[errorKey] : '');
  const resolvedMessage = messageText || (messageKey && t[messageKey] ? t[messageKey] : '');

  return (
    <section className="contribute-import">
      <p className="page-description">{t.contributeImportDescription || t.contributeDescription}</p>
      <section className="form contribute-form" aria-live="polite">
        <label className="form-field">
          <span>{t.contributeUploadLabel}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={status === 'extracting'}
          />
        </label>
        <p className="form-hint">{t.contributeUploadHint}</p>
        {selectedFiles.length ? (
          <div className="contribute-files">
            <h2 className="contribute-section-title">{t.contributeImagesTitle}</h2>
            <ul className="contribute-file-list">
              {selectedFiles.map((file, index) => {
                const label = getFileLabel(file, index);
                const statusKey = file.status || 'ready';
                const statusLabel = getFileStatusLabel(statusKey);
                const startedAt = isFiniteNumber(file.processingStartedAt) ? file.processingStartedAt : null;
                const completedAt = isFiniteNumber(file.processingCompletedAt) ? file.processingCompletedAt : null;
                const recordedDurationMs = isFiniteNumber(file.processingDurationMs)
                  ? file.processingDurationMs
                  : null;
                let statusSuffix = '';
                if (statusKey === 'processing' && startedAt !== null) {
                  const elapsedMs = Math.max(0, processingNow - startedAt);
                  const elapsedLabel = formatSecondsFromDuration(elapsedMs);
                  if (elapsedLabel) {
                    statusSuffix = ` (${elapsedLabel})`;
                  }
                } else if (statusKey !== 'ready') {
                  let totalDuration = recordedDurationMs;
                  if (!isFiniteNumber(totalDuration) && startedAt !== null && completedAt !== null) {
                    totalDuration = Math.max(0, completedAt - startedAt);
                  }
                  const totalLabel = formatSecondsFromDuration(totalDuration);
                  if (totalLabel) {
                    statusSuffix = ` (${totalLabel})`;
                  }
                }
                const statusLabelWithTime = `${statusLabel}${statusSuffix}`;
                const statusText =
                  statusKey === 'error' && file.errorMessage
                    ? `${statusLabelWithTime}: ${file.errorMessage}`
                    : statusLabelWithTime;
                return (
                  <li
                    key={file.id || `${label}-${index}`}
                    className={`contribute-file-item contribute-file-item--${statusKey}`}
                  >
                    <div className="contribute-file-details">
                      <span className="contribute-file-name">{label}</span>
                      <span className="contribute-file-meta">{`${file.width}×${file.height}`}</span>
                    </div>
                    <span className={`contribute-file-status contribute-file-status--${statusKey}`}>
                      {statusText}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <div className="form-actions contribute-actions">
          <button
            type="button"
            onClick={handleExtract}
            disabled={!selectedFiles.length || status === 'extracting'}
          >
            {status === 'extracting' ? t.contributeExtracting : t.contributeExtract}
          </button>
          <button type="button" className="secondary" onClick={handleClearSelection} disabled={!selectedFiles.length}>
            {t.contributeClear}
          </button>
        </div>
        <p className="form-hint contribute-import-next">
          {t.contributeImportNextStep}{' '}
          <Link to="/contribute/validate">{t.contributeMenuValidate || 'Validate'}</Link>
        </p>
      </section>
      <section className="form-messages" aria-live="polite">
        {resolvedMessage ? (
          <p className="form-message" role="status">
            {resolvedMessage}
          </p>
        ) : null}
        {resolvedError ? (
          <p className="form-message" role="alert">
            {resolvedError}
          </p>
        ) : null}
      </section>
    </section>
  );
}
