import { useState, useEffect, useContext, createContext, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapseAllContextValue {
  collapseSignal: number;
  expandSignal: number;
  collapseAll: () => void;
  expandAll: () => void;
}

const CollapseAllContext = createContext<CollapseAllContextValue>({
  collapseSignal: 0,
  expandSignal: 0,
  collapseAll: () => {},
  expandAll: () => {},
});

export function CollapseAllProvider({ children }: { children: React.ReactNode }) {
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [expandSignal, setExpandSignal] = useState(0);
  const collapseAll = useCallback(() => setCollapseSignal((n) => n + 1), []);
  const expandAll = useCallback(() => setExpandSignal((n) => n + 1), []);
  return (
    <CollapseAllContext.Provider value={{ collapseSignal, expandSignal, collapseAll, expandAll }}>
      {children}
    </CollapseAllContext.Provider>
  );
}

export function useCollapseAll() {
  return useContext(CollapseAllContext);
}

interface CollapsibleModuleProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  variant?: "default" | "glass";
}

export function CollapsibleModule({
  title,
  icon,
  badge,
  headerRight,
  children,
  defaultOpen = true,
  className = "",
  variant = "glass",
}: CollapsibleModuleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { collapseSignal, expandSignal } = useContext(CollapseAllContext);

  useEffect(() => {
    if (collapseSignal > 0) setIsOpen(false);
  }, [collapseSignal]);

  useEffect(() => {
    if (expandSignal > 0) setIsOpen(true);
  }, [expandSignal]);

  const baseClasses = variant === "glass"
    ? "glass-card rounded-lg"
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
        {headerRight && (
          <div onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
      </div>
      {isOpen && <div className="mobile-compact-module-content">{children}</div>}
    </div>
  );
}

export default CollapsibleModule;
