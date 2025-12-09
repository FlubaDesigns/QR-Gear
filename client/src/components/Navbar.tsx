import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Menu, ShoppingCart, Sun, Moon, Plus, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import logoImage from "@assets/file_00000000215871f59ea892893d25458d_(1)_1765258506688.png";

export default function Navbar() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const cartItemCount = 0;
  
  const settingsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const savedFontSize = localStorage.getItem("fontSize");
    
    if (savedTheme === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
    
    if (savedFontSize) {
      const size = parseInt(savedFontSize);
      setFontSize(size);
      document.documentElement.style.fontSize = `${size}px`;
    }
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Close settings if clicked outside settings area
      if (settingsRef.current && !settingsRef.current.contains(target)) {
        setSettingsOpen(false);
      }
      
      // Close menu if clicked outside both the toggle button AND the nav dropdown
      const clickedInMenu = menuRef.current?.contains(target);
      const clickedInNav = navRef.current?.contains(target);
      if (!clickedInMenu && !clickedInNav) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  };

  const adjustFontSize = (delta: number) => {
    const newSize = Math.min(24, Math.max(12, fontSize + delta));
    setFontSize(newSize);
    document.documentElement.style.fontSize = `${newSize}px`;
    localStorage.setItem("fontSize", String(newSize));
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/creator", label: "Create" },
    { href: "/gallery", label: "Gallery" },
    { href: "/account", label: "Account" },
    { href: "/admin", label: "Admin" },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" data-testid="link-home">
          <img 
            src={logoImage} 
            alt="QRGear Logo" 
            className="h-10 w-10 object-contain dark:invert"
          />
          <span className="site-title">
            QR<span style={{ color: "hsl(187 80% 50%)" }}>Gear</span>.com
          </span>
        </Link>

        <nav ref={navRef} className={`nav-links ${menuOpen ? "open" : ""}`}>
          <button 
            className="mobile-close-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            data-testid="button-close-menu"
          >
            <X size={32} />
          </button>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={location === link.href ? "active" : ""}
                onClick={() => setMenuOpen(false)}
                data-testid={`link-${link.label.toLowerCase()}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/cart"
              className="login-link"
              onClick={() => setMenuOpen(false)}
              data-testid="link-store"
            >
              Store
            </Link>
          </li>
        </nav>

        <div className="header-actions">
          <div className="gear-wrap" ref={settingsRef}>
            <button
              className="gear-btn"
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setMenuOpen(false);
              }}
              aria-label="Settings"
              data-testid="button-settings"
            >
              <Settings size={24} />
            </button>

            <div className={`settings-menu ${settingsOpen ? "open" : ""}`}>
              <button 
                className="mobile-close-btn"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
                data-testid="button-close-settings"
              >
                <X size={32} />
              </button>
              <h4>Settings</h4>
              
              <div className="setting-row">
                <span>Theme</span>
                <button
                  className="theme-toggle"
                  onClick={toggleTheme}
                  data-testid="button-theme-toggle"
                >
                  <span className="toggle-track">
                    <span className="toggle-thumb" />
                  </span>
                  <span style={{ marginLeft: 8 }}>
                    {isDark ? <Moon size={16} /> : <Sun size={16} />}
                  </span>
                </button>
              </div>

              <div className="setting-row">
                <span>Font Size</span>
                <div className="font-size-controls" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => adjustFontSize(-2)}
                    disabled={fontSize <= 12}
                    data-testid="button-font-decrease"
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ minWidth: 32, textAlign: "center" }}>{fontSize}</span>
                  <button
                    onClick={() => adjustFontSize(2)}
                    disabled={fontSize >= 24}
                    data-testid="button-font-increase"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div ref={menuRef} className="menu-wrap">
            <button
              className="menu-toggle"
              onClick={() => {
                setMenuOpen(!menuOpen);
                setSettingsOpen(false);
              }}
              aria-label="Menu"
              data-testid="button-menu"
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>

          <Link href="/cart" className="relative" data-testid="button-cart">
            <button className="gear-btn">
              <ShoppingCart size={24} />
              {cartItemCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {cartItemCount}
                </Badge>
              )}
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}
