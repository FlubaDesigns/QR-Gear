import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface AdminSectionCardProps {
  title?: string;
  icon?: LucideIcon;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function AdminSectionCard({
  title,
  icon: Icon,
  description,
  actions,
  children,
  className = "",
  noPadding = false,
}: AdminSectionCardProps) {
  return (
    <Card className={`border border-border ${className}`} data-testid="admin-section-card">
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold truncate">{title}</CardTitle>
              {description && (
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={noPadding ? "p-0" : ""}>{children}</CardContent>
    </Card>
  );
}
