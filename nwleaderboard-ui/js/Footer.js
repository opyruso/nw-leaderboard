const { Link } = ReactRouterDOM;

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const footerRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const updateHeight = () => {
      if (!footerRef.current) {
        return;
      }
      document.documentElement.style.setProperty(
        '--site-footer-height',
        `${footerRef.current.offsetHeight}px`,
      );
    };

    updateHeight();

    let observer;
    if (footerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeight);
      observer.observe(footerRef.current);
    }

    window.addEventListener('resize', updateHeight);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return (
    <footer ref={footerRef} className="site-footer">
      <div className="site-footer__content">
        <small className="site-footer__brand">
          <img
            className="site-footer__brand-logo"
            src="/images/icons/logo.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="site-footer__brand-text">
            oPyRuSo (TM) 2025 - {currentYear}
          </span>
        </small>
        <nav className="site-footer__links" aria-label="Footer links">
          <Link className="site-footer__link" to="/suggestions">
            Bug / Suggestion
          </Link>
        </nav>
      </div>
    </footer>
  );
}
