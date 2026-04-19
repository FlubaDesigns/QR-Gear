import { useLocation } from "wouter";
import { Zap, Hammer, MapPin, ShoppingCart, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getModeForPath } from "@/components/admin/adminNavConfig";

interface NavSection {
  label: string;
  icon: LucideIcon;
  href: string;
}

const sections: NavSection[] = [
  { label: "Run", icon: Zap, href: "/admin" },
  { label: "Build", icon: Hammer, href: "/admin/products" },
  { label: "Place", icon: MapPin, href: "/admin/store-builder" },
  { label: "Sell", icon: ShoppingCart, href: "/admin/orders" },
  { label: "System", icon: Settings, href: "/admin/settings" },
];

export default function AdminBottomNav() {
  const [location, navigate] = useLocation();

  const isActive = (section: NavSection) => {
    const mode = getModeForPath(location);
    if (section.label === "Run") {
      return mode === null && location.startsWith("/admin");
    }
    return mode === section.label;
  };

  return (
    <>
      {/* Mobile: fixed bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm"
        data-testid="admin-bottom-nav"
      >
        <div className="flex items-center justify-around">
          {sections.map((section) => {
            const active = isActive(section);
            const Icon = section.icon;
            return (
              <button
                key={section.label}
                onClick={() => navigate(section.href)}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 min-h-[56px] min-w-[56px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`nav-${section.label.toLowerCase()}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{section.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop: fixed left sidebar */}
      <nav
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 w-16 flex-col items-center py-4 gap-1 border-r border-border bg-background/95 backdrop-blur-sm"
        data-testid="admin-side-nav"
      >
        {sections.map((section) => {
          const active = isActive(section);
          const Icon = section.icon;
          return (
            <button
              key={section.label}
              onClick={() => navigate(section.href)}
              title={section.label}
              className={`flex flex-col items-center gap-1 py-3 px-2 w-full rounded-md transition-colors ${
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              data-testid={`sidenav-${section.label.toLowerCase()}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-semibold tracking-wide uppercase">
                {section.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
