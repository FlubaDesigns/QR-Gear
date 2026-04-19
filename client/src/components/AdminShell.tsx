import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AdminSectionTabs, { type AdminTab } from "@/components/admin/AdminSectionTabs";

interface AdminShellProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  noPadding?: boolean;
  tabs?: AdminTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  stickyBar?: ReactNode;
  sectionNav?: ReactNode;
}

export default function AdminShell({
  title,
  subtitle,
  icon: Icon,
  backHref = "/admin/run",
  actions,
  children,
  maxWidth,
  noPadding = false,
  tabs,
  activeTab,
  onTabChange,
  stickyBar,
  sectionNav,
}: AdminShellProps) {
  const [, navigate] = useLocation();

  return (
    <div className="qr-admin-page">
      <div className="qr-admin-bar">
        <div className="qr-admin-bar__inner">
          <div className="qr-admin-bar__left">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backHref)}
              className="text-white hover:bg-white/10 min-h-12 min-w-12 flex-shrink-0"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              {Icon && <Icon className="qr-admin-bar__icon hidden sm:block flex-shrink-0" />}
              <div className="min-w-0">
                <h1 className="qr-admin-bar__title truncate" data-testid="text-page-title">
                  {title}
                </h1>
                {subtitle && (
                  <p className="qr-admin-bar__subtitle hidden sm:block truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
          {actions && (
            <div className="qr-admin-bar__right flex-wrap">
              {actions}
            </div>
          )}
        </div>
      </div>

      {sectionNav}

      {tabs && activeTab && (
        <AdminSectionTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          className="sticky top-0 z-40"
        />
      )}

      <main
        className={noPadding ? "" : "qr-admin-main"}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {children}
      </main>

      {stickyBar && (
        <>
          <div className="h-16" />
          <div className="fixed bottom-14 md:bottom-0 md:left-16 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3">
            <div className="mx-auto max-w-[640px] flex items-center justify-end gap-3">
              {stickyBar}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
