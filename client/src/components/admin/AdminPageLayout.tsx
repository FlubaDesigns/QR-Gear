import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import type { SubNavItem } from "@/components/admin/adminNavConfig";

export interface PrimaryAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  "data-testid"?: string;
}

interface AdminPageLayoutProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  backHref?: string;
  hideBack?: boolean;
  primaryActions?: PrimaryAction[];
  extraActions?: ReactNode;
  sectionNav: SubNavItem[];
  tabs?: AdminTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  stickyBar?: ReactNode;
  noPadding?: boolean;
  maxWidth?: string;
  children: ReactNode;
}

export default function AdminPageLayout({
  title,
  subtitle,
  icon,
  backHref,
  hideBack,
  primaryActions,
  extraActions,
  sectionNav,
  tabs,
  activeTab,
  onTabChange,
  stickyBar,
  noPadding,
  maxWidth,
  children,
}: AdminPageLayoutProps) {
  const actionNodes =
    primaryActions && primaryActions.length > 0 ? (
      <>
        {primaryActions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <Button
              key={action.label}
              variant={action.variant ?? "default"}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              data-testid={action["data-testid"]}
              className="text-white border-white/20"
            >
              {ActionIcon && <ActionIcon className="h-4 w-4" />}
              {action.label}
            </Button>
          );
        })}
        {extraActions}
      </>
    ) : (
      extraActions ?? undefined
    );

  return (
    <AdminShell
      title={title}
      subtitle={subtitle}
      icon={icon}
      backHref={backHref}
      hideBack={hideBack}
      actions={actionNodes}
      sectionNav={<AdminSectionSubNav items={sectionNav} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      stickyBar={stickyBar}
      noPadding={noPadding}
      maxWidth={maxWidth}
    >
      {children}
    </AdminShell>
  );
}
