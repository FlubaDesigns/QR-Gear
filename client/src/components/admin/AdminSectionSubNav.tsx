import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";

interface SubNavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface AdminSectionSubNavProps {
  items: SubNavItem[];
}

export default function AdminSectionSubNav({ items }: AdminSectionSubNavProps) {
  const [location, navigate] = useLocation();

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1 px-3 overflow-x-auto scrollbar-none py-1.5">
        {items.map((item) => {
          const active = location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              data-testid={`subnav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
