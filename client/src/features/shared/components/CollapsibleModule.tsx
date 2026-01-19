import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleModuleProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  variant?: "default" | "glass";
}

export function CollapsibleModule({
  title,
  icon,
  badge,
  children,
  defaultOpen = true,
  className = "",
  variant = "glass",
}: CollapsibleModuleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const baseClasses = variant === "glass"
    ? "glass-card rounded-lg overflow-hidden"
    : "bg-card border rounded-lg";

  return (
    <div className={`${baseClasses} ${className}`}>
      <div
        className="mobile-compact-module-header cursor-pointer select-none flex items-center"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={`collapsible-header-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon && <span className="text-primary">{icon}</span>}
        <span className="flex-1 font-semibold text-base">{title}</span>
        {badge}
      </div>
      {isOpen && <div className="mobile-compact-module-content">{children}</div>}
    </div>
  );
}

export default CollapsibleModule;
