import { getMutationIconSources } from '../mutations.js';

function MutationIcon({ src, kind }) {
  const [hidden, setHidden] = React.useState(false);

  if (!src || hidden) {
    return null;
  }

  const className = kind ? `mutation-icon mutation-icon--${kind}` : 'mutation-icon';

  return (
    <li className="mutation-icon-item">
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={className}
        loading="lazy"
        decoding="async"
        draggable="false"
        onError={() => setHidden(true)}
      />
    </li>
  );
}

export default function MutationIconList({ typeId, promotionId, curseId, className = '' }) {
  const icons = React.useMemo(
    () => getMutationIconSources({ typeId, promotionId, curseId }),
    [typeId, promotionId, curseId],
  );

  if (icons.length === 0) {
    return null;
  }

  const listClassName = className ? `mutation-icon-list ${className}` : 'mutation-icon-list';

  return (
    <ul className={listClassName} role="list">
      {icons.map((icon) => (
        <MutationIcon key={`${icon.kind}:${icon.id}`} src={icon.src} kind={icon.kind} />
      ))}
    </ul>
  );
}
