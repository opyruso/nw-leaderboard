import useDragScroll from '../hooks/useDragScroll.js';

export default function SeasonCarousel({
  label,
  ariaLabel,
  loading = false,
  error = false,
  seasons = [],
  selectedSeasonId = null,
  onSelect,
  allLabel,
  loadingLabel,
  errorLabel,
  emptyLabel,
  formatSeasonLabel,
  formatSeasonTitle,
  displayRange = true,
  hideLabel = false,
}) {
  const trackRef = React.useRef(null);
  useDragScroll(trackRef);

  const handleSelect = React.useCallback(
    (value) => {
      if (typeof onSelect === 'function') {
        onSelect(value);
      }
    },
    [onSelect],
  );

  const activeId = selectedSeasonId === null || selectedSeasonId === undefined
    ? null
    : String(selectedSeasonId);

  const renderStatus = (message, isError = false) => (
    <p className={isError ? 'season-carousel-status error' : 'season-carousel-status'}>{message}</p>
  );

  let content = null;
  if (loading) {
    content = renderStatus(loadingLabel || 'Loading…');
  } else if (error) {
    content = renderStatus(errorLabel || 'Unable to load seasons.', true);
  } else if (!Array.isArray(seasons) || seasons.length === 0) {
    content = renderStatus(emptyLabel || 'No season available.');
  } else {
    content = (
      <div className="season-carousel-track" role="list" ref={trackRef}>
        <button
          type="button"
          className={activeId === null ? 'season-carousel-item selected' : 'season-carousel-item'}
          onClick={() => handleSelect(null)}
          aria-pressed={activeId === null}
          role="listitem"
        >
          <span className="season-carousel-item-label">{allLabel || 'All'}</span>
        </button>
        {seasons.map((season) => {
          if (!season || season.id === null || season.id === undefined) {
            return null;
          }
          const seasonId = String(season.id);
          const labelText =
            typeof formatSeasonLabel === 'function' ? formatSeasonLabel(season) : `Season ${seasonId}`;
          const rawTitle =
            typeof formatSeasonTitle === 'function'
              ? formatSeasonTitle(season)
              : labelText;
          const titleText = typeof rawTitle === 'string' ? rawTitle.trim() : '';
          const rangeText = season.dateBegin || season.dateEnd ? formatSeasonRange(season.dateBegin, season.dateEnd) : '';
          const isActive = seasonId === activeId;
          const tooltipParts = [];
          if (titleText) {
            tooltipParts.push(titleText);
          }
          if (!displayRange && rangeText) {
            const alreadyIncluded = titleText && titleText.includes(rangeText);
            if (!alreadyIncluded) {
              tooltipParts.push(rangeText);
            }
          }
          const tooltip = tooltipParts.join(' — ');
          return (
            <button
              key={seasonId}
              type="button"
              className={isActive ? 'season-carousel-item selected' : 'season-carousel-item'}
              onClick={() => handleSelect(seasonId)}
              aria-pressed={isActive}
              title={tooltip || undefined}
              role="listitem"
            >
              <span className="season-carousel-item-label">{labelText}</span>
              {displayRange && rangeText ? (
                <span className="season-carousel-item-range">{rangeText}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  const groupLabel = ariaLabel || label;

  return (
    <div className="season-carousel" role="group" aria-label={groupLabel || undefined}>
      {label && !hideLabel ? <span className="season-carousel-label">{label}</span> : null}
      {content}
    </div>
  );
}

function formatSeasonRange(dateBegin, dateEnd) {
  if (!dateBegin && !dateEnd) {
    return '';
  }
  if (dateBegin && dateEnd) {
    return `${dateBegin} – ${dateEnd}`;
  }
  if (dateBegin) {
    return `${dateBegin} – ?`;
  }
  return `? – ${dateEnd}`;
}

