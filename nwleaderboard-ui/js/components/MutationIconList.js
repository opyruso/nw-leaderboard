import { LangContext } from '../i18n.js';
import { capitaliseWords } from '../text.js';
import { getMutationIconSources } from '../mutations.js';

function formatMutationValue(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const normalised = trimmed.replace(/[\s_-]+/g, ' ');
  return capitaliseWords(normalised);
}

function MutationIcon({ src, kind, label }) {
  const [hidden, setHidden] = React.useState(false);

  if (!src || hidden) {
    return null;
  }

  const className = kind ? `mutation-icon mutation-icon--${kind}` : 'mutation-icon';

  return (
    <li className="mutation-icon-item">
      <img
        src={src}
        alt={label || ''}
        aria-hidden={label ? undefined : true}
        className={className}
        loading="lazy"
        decoding="async"
        draggable="false"
        onError={() => setHidden(true)}
        title={label || undefined}
      />
      {label ? <span className="visually-hidden">{label}</span> : null}
    </li>
  );
}

export default function MutationIconList({ typeId, promotionId, curseId, className = '' }) {
  const { t } = React.useContext(LangContext);
  const icons = React.useMemo(
    () => getMutationIconSources({ typeId, promotionId, curseId }),
    [typeId, promotionId, curseId],
  );

  if (icons.length === 0) {
    return null;
  }

  const listClassName = className ? `mutation-icon-list ${className}` : 'mutation-icon-list';
  const labels = React.useMemo(() => {
    const typeLabel = typeof t.mutationFilterTypeLabel === 'string' ? t.mutationFilterTypeLabel : '';
    const promotionLabel =
      typeof t.mutationFilterPromotionLabel === 'string' ? t.mutationFilterPromotionLabel : '';
    const curseLabel = typeof t.mutationFilterCurseLabel === 'string' ? t.mutationFilterCurseLabel : '';
    return {
      type: typeLabel || 'Mutation type',
      promotion: promotionLabel || 'Promotion',
      curse: curseLabel || 'Curse',
    };
  }, [t]);

  return (
    <ul className={listClassName} role="list">
      {icons.map((icon) => (
        <MutationIcon
          key={`${icon.kind}:${icon.id}`}
          src={icon.src}
          kind={icon.kind}
          label={(() => {
            const prefix = labels[icon.kind] || '';
            const formattedValue = formatMutationValue(icon.id) || icon.id;
            if (prefix && formattedValue) {
              return `${prefix}: ${formattedValue}`;
            }
            if (formattedValue) {
              return formattedValue;
            }
            return '';
          })()}
        />
      ))}
    </ul>
  );
}
