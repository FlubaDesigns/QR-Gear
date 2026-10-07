import { useLocation } from "wouter";
import { ADMIN_MAIN_NAV, getModeForPath, type SubNavItem } from "@/components/admin/adminNavConfig";

export default function AdminBottomNav() {
  const [location, navigate] = useLocation();

  const isActive = (section: SubNavItem) => {
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
        <div className="grid grid-cols-6 items-center">
          {ADMIN_MAIN_NAV.map((section) => {
            const active = isActive(section);
            const Icon = section.icon;
            return (
              <button
                key={section.label}
              aria-current={active ? "page" : undefined}
                onClick={() => navigate(section.href)}
                className={`flex flex-col items-center gap-0.5 py-2 px-1 min-h-[56px] min-w-0 w-full transition-colors ${
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
        {ADMIN_MAIN_NAV.map((section) => {
          const active = isActive(section);
          const Icon = section.icon;
          return (
            <button
              key={section.label}
              aria-current={active ? "page" : undefined}
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
