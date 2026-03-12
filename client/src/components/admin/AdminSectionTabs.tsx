import { useRef, useEffect } from "react";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";

export interface AdminTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
}

interface AdminSectionTabsProps {
  tabs: AdminTab[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export default function AdminSectionTabs({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: AdminSectionTabsProps) {
  const [, navigate] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }, [activeTab]);

  const handleClick = (tab: AdminTab) => {
    if (tab.href) {
      navigate(tab.href);
    }
    onTabChange?.(tab.id);
  };

  return (
    <div
      ref={scrollRef}
      className={`flex gap-1 overflow-x-auto scrollbar-hide border-b border-border bg-card/50 px-2 ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
      data-testid="admin-section-tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => handleClick(tab)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 min-h-[44px] ${
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
