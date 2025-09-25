import { getDungeonIconPath } from '../dungeons.js';

export default function DungeonIcon({ dungeonId, className = '' }) {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [dungeonId]);

  const src = React.useMemo(() => getDungeonIconPath(dungeonId), [dungeonId]);

  if (!src || hasError) {
    return null;
  }

  const combinedClassName = className ? `title-icon ${className}` : 'title-icon';

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={combinedClassName}
      onError={() => setHasError(true)}
      draggable="false"
      loading="lazy"
      decoding="async"
    />
  );
}
