import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
}

export default function AdminShell({
  title,
  subtitle,
  icon: Icon,
  backHref = "/admin",
  backLabel,
  actions,
  children,
  maxWidth,
  noPadding = false,
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

      <main
        className={noPadding ? "" : "qr-admin-main"}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {children}
      </main>
    </div>
  );
}
