import { getMutationIconSources } from '../mutations.js';

const MUTATION_ICON_COLOR = { r: 0x4f, g: 0x11, b: 0x82 };
const tintedIconCache = new Map();

async function tintMutationIcon(src) {
  if (tintedIconCache.has(src)) {
    return tintedIconCache.get(src);
  }

  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return src;
  }

  const image = new Image();
  image.decoding = 'async';
  image.crossOrigin = 'anonymous';

  const tintedSource = await new Promise((resolve, reject) => {
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context not available'));
          return;
        }

        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;

        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3];
          if (alpha === 0) {
            continue;
          }

          const intensity = data[index] / 255;
          const factor = 1 - intensity;

          data[index] = Math.round(MUTATION_ICON_COLOR.r * factor);
          data[index + 1] = Math.round(MUTATION_ICON_COLOR.g * factor);
          data[index + 2] = Math.round(MUTATION_ICON_COLOR.b * factor);
        }

        context.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL());
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      reject(new Error(`Unable to load mutation icon: ${src}`));
    };

    image.src = src;
  });

  tintedIconCache.set(src, tintedSource);
  return tintedSource;
}

function MutationIcon({ src }) {
  const [hidden, setHidden] = React.useState(false);
  const [tintedSrc, setTintedSrc] = React.useState(null);

  React.useEffect(() => {
    let isCancelled = false;

    if (!src) {
      setTintedSrc(null);
      return undefined;
    }

    setHidden(false);
    setTintedSrc(null);

    tintMutationIcon(src)
      .then((result) => {
        if (!isCancelled) {
          setTintedSrc(result);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHidden(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [src]);

  if (!src || hidden || !tintedSrc) {
    return null;
  }

  return (
    <li className="mutation-icon-item">
      <img
        src={tintedSrc}
        alt=""
        aria-hidden="true"
        className="mutation-icon"
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
        <MutationIcon key={`${icon.kind}:${icon.id}`} src={icon.src} />
      ))}
    </ul>
  );
}
