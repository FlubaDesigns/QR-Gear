export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer__grid">
        <div className="badge">
          {currentYear} QRGear.com
        </div>
        <div className="badge">
          Physical • Digital • Connected
        </div>
      </div>
    </footer>
  );
}
