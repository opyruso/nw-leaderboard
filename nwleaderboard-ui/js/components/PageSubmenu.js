export default function PageSubmenu({ children, className = '', ...rest }) {
  const navRef = React.useRef(null);
  const [isCompact, setIsCompact] = React.useState(false);

  React.useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) {
      return undefined;
    }

    const pageElement = navElement.closest('.page');
    const titleElement = pageElement ? pageElement.querySelector('.page-title') : null;

    if (!titleElement) {
      return undefined;
    }

    const updateCompactState = (entry) => {
      if (!entry) {
        return;
      }

      const fullyHidden =
        entry.intersectionRatio === 0 && entry.boundingClientRect.bottom <= 0;

      setIsCompact((previous) => (previous === fullyHidden ? previous : fullyHidden));
    };

    const initialRect = titleElement.getBoundingClientRect();

    if (typeof IntersectionObserver !== 'function') {
      const fullyHidden = initialRect.bottom <= 0;
      setIsCompact((previous) => (previous === fullyHidden ? previous : fullyHidden));
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => updateCompactState(entry),
      { threshold: [0, 1] },
    );

    observer.observe(titleElement);

    updateCompactState({
      intersectionRatio:
        initialRect.height === 0 || initialRect.bottom <= 0 ? 0 : 1,
      boundingClientRect: initialRect,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const classes = React.useMemo(() => {
    const list = ['page-submenu'];

    if (className) {
      list.push(className);
    }

    if (isCompact) {
      list.push('page-submenu--compact');
    }

    return list.join(' ');
  }, [className, isCompact]);

  return (
    <nav ref={navRef} className={classes} {...rest}>
      {children}
    </nav>
  );
}
