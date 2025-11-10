import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Settings, X } from "lucide-react";

export function Header() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("qrgear-theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("qrgear-theme", newTheme);
  };

  const closeMenus = () => {
    setMenuOpen(false);
    setSettingsOpen(false);
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
    { href: "/design", label: "Design Studio" },
    { href: "/account", label: "My Account" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" onClick={closeMenus}>
          <img className="site-logo" src="/img/qr-gear-logo.png" alt="QR Gear logo" />
          <h1 className="site-title">QR Gear</h1>
        </Link>

        <div className="header-actions">
          <div className="gear-wrap">
            <button
              id="settingsBtn"
              className="gear-btn"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              title="Display & theme settings"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSettingsOpen(!settingsOpen);
                setMenuOpen(false);
              }}
              data-testid="button-settings"
            >
              <Settings className="w-6 h-6" />
            </button>

            {settingsOpen && (
              <div
                id="settingsMenu"
                className="settings-menu open"
                role="menu"
                aria-label="Display & theme settings"
                onClick={(e) => e.stopPropagation()}
              >
                <h4>Display</h4>
                <div className="setting-row">
                  <span>Theme</span>
                  <button
                    className={`theme-toggle ${theme === "light" ? "is-on" : ""}`}
                    id="themeToggle"
                    aria-label="Toggle light/dark"
                    type="button"
                    onClick={toggleTheme}
                    data-testid="button-theme-toggle"
                  >
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            className={`menu-toggle ${menuOpen ? "open" : ""}`}
            id="menuBtn"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-controls="navMenu"
            title={menuOpen ? "Close menu" : "Open menu"}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
              setSettingsOpen(false);
            }}
            data-testid="button-menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <ul className={`nav-links ${menuOpen ? "open" : ""}`} id="navMenu">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={closeMenus}
                className={location === link.href ? "active" : ""}
                data-testid={`link-nav-${link.label.toLowerCase().replace(" ", "-")}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/login"
              className="login-link"
              onClick={closeMenus}
              data-testid="link-login"
            >
              Login
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
