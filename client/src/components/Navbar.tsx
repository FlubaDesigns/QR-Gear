import { privateQueryKey } from '@/lib/identityCache';
import { useState, useEffect } from "react";
import { PUBLIC_SHOP_PATH } from '@shared/navigation';
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Menu, X, Settings, User, Shield, LogIn, LogOut, Sun, Moon, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRButton } from "@/components/QRButton";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { signOut } from "@/lib/firebase";
import type { CartItem } from "@shared/schema";
import logoPng from "@/assets/logo.png";
import { actionCards } from "@/components/ActionCards";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const { itemCount: guestCartCount } = useCart();

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setMenuOpen(false);
      setLocation("/");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };
  
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('fontSize') || '16', 10);
    }
    return 16;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem('fontSize', fontSize.toString());
  }, [fontSize]);

  const { data: serverCartItems } = useQuery<CartItem[]>({
    queryKey: privateQueryKey("/api/cart", user?.id),
    enabled: !!user?.id,
  });

  const cartCount = isAuthenticated ? (serverCartItems || []).length : guestCartCount;

  useEffect(() => {
    setMenuOpen(false);
    setSettingsOpen(false);
  }, [location]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [menuOpen]);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/build", label: "Create" },
    { href: PUBLIC_SHOP_PATH, label: "Shop" },
  ];

  return (
    <>
      <header className="site-header">
        <div className="container header__inner">
          <Link href="/" className="brand" data-testid="link-home">
            <img src={logoPng} alt="QR Gear" className="brand__logo-svg" />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="min-h-12 text-sm font-medium" data-testid="nav-qr-types">QR Types</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {actionCards.map(card => (
                  <DropdownMenuItem key={card.href} asChild>
                    <Link href={card.href} className="min-h-12" data-testid={`nav-type-${card.href.slice(1)}`}>{card.title}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {isAdmin && (
              <Link
                href="/admin"
                className={`text-sm font-medium transition-colors ${
                  location === "/admin" ? "text-ice" : ""
                }`}
                data-testid="nav-admin"
              >
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <Button asChild
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  aria-label={isAdmin ? "Admin dashboard" : "My account"}
                  data-testid="button-user-dashboard"
                ><Link href={isAdmin ? "/admin" : "/account"}>
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{isAdmin ? "Admin" : "My Account"}</span>
                </Link></Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setMenuOpen(false);
              }}
              aria-label="Site Settings"
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>

            <Link href="/cart" data-testid="link-cart" aria-label={`Cart, ${cartCount} items`} className="relative inline-flex items-center justify-center h-10 w-10">
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs"
                    data-testid="cart-count"
                  >
                    {cartCount}
                  </Badge>
                )}
            </Link>

            <Link href="/build" className="hidden sm:block px-4 py-2 rounded bg-primary text-primary-foreground" data-testid="button-get-started">
                Get Started
              </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setMenuOpen(!menuOpen);
                setSettingsOpen(false);
              }}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen} aria-controls="mobile-navigation"
              data-testid="button-mobile-menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        >
          <div 
            className="absolute top-16 left-0 right-0 md:left-auto md:right-4 md:w-72 border-t md:border md:rounded-xl bg-slate-950 text-white max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <nav id="mobile-navigation" aria-label="Main navigation" className="container md:px-4 py-4 flex flex-col gap-2">
              <div className="md:hidden flex flex-col gap-2 mb-4">
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
              </div>

              <div className="md:hidden flex flex-col gap-1 border-t pt-4 pb-4">
                <p className="px-4 text-sm font-semibold">QR Types &amp; Ideas</p>
                {actionCards.map(card => (
                  <Link key={card.href} href={card.href} className="min-h-12 flex items-center px-4 rounded-lg" onClick={() => setMenuOpen(false)} data-testid={`mobile-nav-type-${card.href.slice(1)}`}>{card.title}</Link>
                ))}
              </div>

              <div className="border-t md:border-t-0 pt-4 md:pt-0 flex flex-col gap-1">
                {isAuthenticated ? (
                  <>
                    <div className="text-sm text-muted-foreground mb-2 px-4" data-testid="text-username">
                      Signed in as {user?.firstName || user?.email || 'User'}
                    </div>
                    <Button asChild variant="ghost" className="w-full justify-start gap-2" data-testid="link-account"><Link href="/account" onClick={() => setMenuOpen(false)}>
                        <User className="w-4 h-4" />
                        My Account
                      </Link></Button>
                    {isAdmin && (
                      <Button asChild variant="ghost" className="w-full justify-start gap-2" data-testid="link-admin"><Link href="/admin" onClick={() => setMenuOpen(false)}>
                          <Shield className="w-4 h-4" />
                          Admin Panel
                        </Link></Button>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-2" 
                      onClick={handleSignOut}
                      data-testid="button-logout"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="ghost" className="w-full justify-start gap-2" data-testid="button-login"><Link href="/login" onClick={() => setMenuOpen(false)}>
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </Link></Button>
                  </>
                )}
              </div>

              <Link href="/build" className="mt-4 md:hidden rounded bg-primary text-primary-foreground p-3 text-center" onClick={() => setMenuOpen(false)} data-testid="mobile-get-started">Get Started</Link>
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
            className="absolute top-16 right-4 w-72 glass-card card rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card__title mb-4">
              Site Settings
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                </div>
                <Switch
                  id="dark-mode"
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                  data-testid="switch-dark-mode"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  <Label>Font Size: {fontSize}px</Label>
                </div>
                <Slider
                  aria-label="Text size" value={[fontSize]}
                  onValueChange={(value) => setFontSize(value[0])}
                  min={12}
                  max={24}
                  step={1}
                  data-testid="slider-font-size"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
