const SITE_NAME = 'New World Leaderboard';
const SITE_TAGLINE = 'By oPy For Stats Lovers';
const SITE_START_YEAR = 2025;

function getYearRange(startYear = SITE_START_YEAR) {
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(currentYear) || currentYear <= startYear) {
    return String(startYear);
  }
  return `${startYear}-${currentYear}`;
}

export function getBaseDocumentTitle() {
  const yearRange = getYearRange();
  return `${SITE_NAME} - ${SITE_TAGLINE} - ${yearRange}`;
}

export function formatDocumentTitle(pageTitle, options = {}) {
  const baseTitle =
    options && Object.prototype.hasOwnProperty.call(options, 'baseTitle')
      ? options.baseTitle || ''
      : getBaseDocumentTitle();
  const appendSiteTitle =
    options && Object.prototype.hasOwnProperty.call(options, 'append')
      ? Boolean(options.append)
      : true;
  const separator =
    options && Object.prototype.hasOwnProperty.call(options, 'separator')
      ? options.separator || ' · '
      : ' · ';

  const trimmedTitle = typeof pageTitle === 'string' ? pageTitle.trim() : '';

  if (!trimmedTitle) {
    return baseTitle || '';
  }

  if (!appendSiteTitle || !baseTitle) {
    return trimmedTitle;
  }

  return `${trimmedTitle}${separator}${baseTitle}`;
}

export function useDocumentTitle(pageTitle, options) {
  const baseTitle =
    options && Object.prototype.hasOwnProperty.call(options, 'baseTitle')
      ? options.baseTitle || ''
      : getBaseDocumentTitle();
  const appendSiteTitle =
    options && Object.prototype.hasOwnProperty.call(options, 'append')
      ? Boolean(options.append)
      : true;
  const separator =
    options && Object.prototype.hasOwnProperty.call(options, 'separator')
      ? options.separator || ' · '
      : ' · ';

  React.useEffect(() => {
    const formatted = formatDocumentTitle(pageTitle, {
      baseTitle,
      append: appendSiteTitle,
      separator,
    });
    if (formatted) {
      document.title = formatted;
    }
  }, [pageTitle, baseTitle, appendSiteTitle, separator]);
}
