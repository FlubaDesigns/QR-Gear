import { useLocation } from "wouter";
import { Package, Layers, Radio, ShoppingCart, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  match: string[];
}

const navItems: NavItem[] = [
  { label: "Products", icon: Package, href: "/admin/products", match: ["/admin/products"] },
  { label: "Collections", icon: Layers, href: "/admin/dynamics", match: ["/admin/dynamics"] },
  { label: "Channels", icon: Radio, href: "/admin/store-library", match: ["/admin/store-library", "/admin/store-builder"] },
  { label: "Orders", icon: ShoppingCart, href: "/admin/orders", match: ["/admin/orders"] },
  { label: "Store", icon: Store, href: "/admin/blanks", match: ["/admin/blanks", "/admin/pricing"] },
];

export default function AdminBottomNav() {
  const [location, navigate] = useLocation();

  const isActive = (item: NavItem) =>
    item.match.some((m) => location.startsWith(m));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden"
      data-testid="admin-bottom-nav"
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.href)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 min-h-[56px] min-w-[56px] transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
