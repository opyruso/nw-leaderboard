export function capitaliseWords(text) {
  if (typeof text !== 'string') {
    return '';
  }

  const segments = text.split(/([\s-]+)/);

  return segments
    .map((segment) => {
      if (!segment) {
        return segment;
      }
      if (/^[\s-]+$/.test(segment)) {
        return segment;
      }
      const [first, ...rest] = segment;
      if (!first) {
        return segment;
      }
      return first.toLocaleUpperCase() + rest.join('');
    })
    .join('');
}
