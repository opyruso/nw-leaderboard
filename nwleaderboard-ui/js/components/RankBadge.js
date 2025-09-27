const MAX_ICON_POSITION = 9;

function normalisePosition(position) {
  if (position === undefined || position === null) {
    return null;
  }
  const numeric = Number(position);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const integer = Math.floor(Math.max(1, numeric));
  if (integer < 1 || integer > MAX_ICON_POSITION) {
    return null;
  }
  return integer;
}

export default function RankBadge({ position, label, className = '' }) {
  const normalised = normalisePosition(position);
  if (!normalised) {
    return null;
  }
  const src = `/images/icons/top/top_${normalised}.png`;
  const alt = label ? `${label} ${normalised}` : `Top ${normalised}`;
  const combinedClassName = className ? `rank-badge ${className}` : 'rank-badge';
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={combinedClassName}
    />
  );
}
