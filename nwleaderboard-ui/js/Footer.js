export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <small>oPyRuSo (TM) 2025 - {currentYear}</small>
    </footer>
  );
}
