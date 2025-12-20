import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Menu, X, Settings, User, Shield, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRButton } from "@/components/QRButton";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();
  const cartCount = 0;

  useEffect(() => {
    setMenuOpen(false);
    setSettingsOpen(false);
  }, [location]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/creator", label: "Create" },
    { href: "/gallery", label: "Shop" },
  ];

  return (
    <>
      <header className="site-header">
        <div className="container header__inner">
          <Link href="/" className="brand" data-testid="link-home">
            <div className="brand__logo">
              QRGear<span className="opacity-60">.com</span>
            </div>
            <div className="brand__tag">Tech-Powered Gear</div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  location === link.href ? "text-ice" : ""
                }`}
                data-testid={`nav-${link.label.toLowerCase()}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setMenuOpen(false);
              }}
              aria-label="Settings"
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>

            <Link href="/cart" data-testid="link-cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
                    data-testid="cart-count"
                  >
                    {cartCount}
                  </Badge>
                )}
              </Button>
            </Link>

            <Link href="/creator" className="hidden sm:block">
              <QRButton variant="accent" size="small" data-testid="button-get-started">
                Get Started
              </QRButton>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => {
                setMenuOpen(!menuOpen);
                setSettingsOpen(false);
              }}
              data-testid="button-mobile-menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        >
          <div 
            className="absolute top-16 left-0 right-0 border-t glass-card"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="container py-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`py-2 px-4 rounded-lg transition-colors ${
                    location === link.href ? "text-ice" : ""
                  }`}
                  onClick={() => setMenuOpen(false)}
                  data-testid={`mobile-nav-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/creator" className="mt-2" onClick={() => setMenuOpen(false)}>
                <QRButton variant="accent" className="w-full" data-testid="mobile-get-started">
                  Get Started
                </QRButton>
              </Link>
            </nav>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setSettingsOpen(false)}
        >
          <div 
            className="absolute top-16 right-4 w-64 glass-card card rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card__title mb-4">
              Menu
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <div className="text-sm text-muted-foreground mb-2" data-testid="text-username">
                    Signed in as {user?.firstName || user?.email || 'User'}
                  </div>
                  <Link href="/account" onClick={() => setSettingsOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2" data-testid="link-account">
                      <User className="w-4 h-4" />
                      My Account
                    </Button>
                  </Link>
                  <Link href="/admin" onClick={() => setSettingsOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2" data-testid="link-admin">
                      <Shield className="w-4 h-4" />
                      Admin Panel
                    </Button>
                  </Link>
                  <a href="/api/logout">
                    <Button variant="ghost" className="w-full justify-start gap-2" data-testid="button-logout">
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </Button>
                  </a>
                </>
              ) : (
                <>
                  <a href="/api/login">
                    <Button variant="default" className="w-full justify-start gap-2" data-testid="button-login">
                      <LogIn className="w-4 h-4" />
                      Sign In with Replit
                    </Button>
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    Sign in to access your account and admin features
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
