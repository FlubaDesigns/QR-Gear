import { useState } from "react";
import PriorityQueue from "@/components/admin/AdminPriorityQueue";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Package,
  DollarSign,
  Image,
  Video,
  Tag,
  Store,
  Settings,
  Globe,
  LayoutDashboard,
  Users,
  Activity,
  Percent,
  ShoppingCart,
  Gift,
  Mail,
  Book,
  Box,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  RefreshCw,
  Plus,
  FileText,
  CreditCard,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  Brain,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetupItem {
  id: string;
  label: string;
  description: string;
  status: "ok" | "missing" | "warning" | "partial";
  action?: string;
  href: string;
  group: string;
}

interface SetupResponse {
  items: SetupItem[];
  missing: number;
  warnings: number;
  generatedAt: string;
}

// ─── Group labels ─────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  payments: "Payments",
  email: "Email",
  fulfillment: "Fulfillment",
  marketplaces: "Marketplaces",
  ai: "AI Brain",
  platform: "Platform",
};

// ─── Setup status config ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ok: { icon: CheckCircle, color: "text-green-500", label: "Connected" },
  missing: { icon: XCircle, color: "text-red-500", label: "Missing" },
  warning: { icon: AlertTriangle, color: "text-amber-500", label: "Warning" },
  partial: { icon: AlertCircle, color: "text-amber-500", label: "Partial" },
};

// ─── Launch readiness ─────────────────────────────────────────────────────────

function LaunchReadiness() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery<SetupResponse>({
    queryKey: ["/api/admin/dashboard/setup"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/setup");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const missing = data?.missing ?? 0;
  const warnings = data?.warnings ?? 0;
  const notOk = items.filter((i) => i.status !== "ok");
  const shown = expanded ? items : notOk;

  const summaryStatus = missing > 0 ? "missing" : warnings > 0 ? "warning" : "ok";
  const SummaryIcon = STATUS_CONFIG[summaryStatus].icon;

  return (
    <div className="space-y-2" data-testid="section-launch-readiness">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Launch Readiness</h2>
          {!isLoading && (
            <Badge
              variant="outline"
              className={`text-xs px-1.5 py-0 h-5 ${
                summaryStatus === "ok"
                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : summaryStatus === "missing"
                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
              }`}
            >
              <SummaryIcon className="w-2.5 h-2.5 mr-1" />
              {summaryStatus === "ok"
                ? "All connected"
                : `${missing} missing${warnings > 0 ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}`}
            </Badge>
          )}
        </div>
        {!isLoading && items.length > 0 && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded((v) => !v)}
            data-testid="button-toggle-setup"
          >
            {expanded ? "Show issues only" : `Show all ${items.length}`}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking connections…
        </div>
      ) : (
        <div className="space-y-1">
          {shown.length === 0 ? (
            <div className="flex items-center gap-2.5 p-3 rounded-md bg-card border border-border">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">All integrations connected and ready.</span>
            </div>
          ) : (
            shown.map((item) => {
              const cfg = STATUS_CONFIG[item.status];
              const Icon = cfg.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 p-2.5 rounded-md bg-card border border-border hover-elevate active-elevate-2"
                  data-testid={`setup-item-${item.id}`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground/60">{GROUP_LABELS[item.group] ?? item.group}</span>
                    </div>
                    {item.status !== "ok" && item.action && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.action}</p>
                    )}
                    {item.status === "ok" && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-1.5 py-0 h-5 flex-shrink-0 ${
                      item.status === "ok"
                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                        : item.status === "missing"
                        ? "bg-red-500/10 text-red-600 border-red-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    }`}
                  >
                    {cfg.label}
                  </Badge>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "New Product", icon: Plus, href: "/admin/products" },
  { label: "Drafts", icon: FileText, href: "/admin/products" },
  { label: "Store Builder", icon: Store, href: "/admin/store-builder" },
  { label: "Marketplaces", icon: Globe, href: "/admin/marketplaces" },
  { label: "Orders", icon: ShoppingCart, href: "/admin/orders" },
  { label: "Payouts", icon: CreditCard, href: "/admin/external-sites" },
  { label: "Pre-Launch", icon: Zap, href: "/admin/launch" },
];

function QuickActions() {
  return (
    <div className="space-y-2" data-testid="section-quick-actions">
      <h2 className="text-sm font-semibold">Quick Actions</h2>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-md border border-border bg-card hover-elevate active-elevate-2 text-center"
              data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground leading-tight">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section launcher grid ────────────────────────────────────────────────────

const ADMIN_SECTIONS = [
  { title: "Dashboard", description: "Analytics and business metrics", icon: LayoutDashboard, href: "/admin/dashboard" },
  { title: "Orders", description: "View and manage customer orders", icon: ShoppingCart, href: "/admin/orders" },
  { title: "Customers", description: "Customer list and order history", icon: Users, href: "/admin/customers" },
  { title: "Products", description: "Manage product catalog", icon: Package, href: "/admin/products" },
  { title: "Blanks", description: "Base products for members", icon: Box, href: "/admin/blanks" },
  { title: "Pricing", description: "Markup, costs, and upcharges", icon: DollarSign, href: "/admin/pricing" },
  { title: "Promo Codes", description: "Create and manage discount codes", icon: Percent, href: "/admin/coupons" },
  { title: "Library", description: "Templates and backgrounds", icon: Image, href: "/admin/library" },
  { title: "Videos", description: "Video backgrounds for QR pages", icon: Video, href: "/admin/videos" },
  { title: "Gifts", description: "Gift packages and codes", icon: Gift, href: "/admin/gifts" },
  { title: "Categories", description: "Collection categories", icon: Tag, href: "/admin/categories" },
  { title: "Store Builder", description: "Manage stores, channels, and collections", icon: Store, href: "/admin/store-builder" },
  { title: "Store Administrator", description: "Create and configure stores", icon: Store, href: "/admin/store-builder?tab=stores" },
  { title: "Partners", description: "Partner stores and product lines", icon: Store, href: "/admin/partners" },
  { title: "Marketplaces", description: "Etsy, eBay, Amazon surfaces", icon: Globe, href: "/admin/marketplaces" },
  { title: "External Sites", description: "Embedded stores and affiliate payouts", icon: Globe, href: "/admin/external-sites" },
  { title: "System Health", description: "Provider status and system health", icon: Activity, href: "/admin/health" },
  { title: "Email Templates", description: "Email templates and logs", icon: Mail, href: "/admin/email-templates" },
  { title: "Settings", description: "API keys and integrations", icon: Settings, href: "/admin/settings" },
  { title: "Admin Manual", description: "Complete management guide", icon: Book, href: "/admin/manual" },
  { title: "Schema Keys", description: "QRG, GRF, ASM, VVS code reference", icon: FileText, href: "/admin/schema-keys" },
];

function SectionGrid() {
  return (
    <div className="space-y-2" data-testid="section-launcher-grid">
      <h2 className="text-sm font-semibold text-muted-foreground">All Sections</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ADMIN_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex flex-col items-center justify-center gap-3 p-4 min-h-[120px] rounded-xl border border-border bg-card hover-elevate active-elevate-2 text-center"
            data-testid={`button-admin-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <section.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">{section.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{section.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  const actionButtons = user ? (
    <Button
      variant="outline"
      size="sm"
      onClick={copyUserId}
      className="font-mono text-xs"
      data-testid="button-copy-user-id"
    >
      Copy ID
    </Button>
  ) : undefined;

  return (
    <AdminShell
      title="QR Gear Admin"
      subtitle="Operator control center"
      icon={Zap}
      backHref="/"
      backLabel="Back"
      actions={actionButtons}
    >
      <div className="space-y-6">
        <LaunchReadiness />
        <PriorityQueue />
        <QuickActions />
        <SectionGrid />

        {user && (
          <div className="p-3 bg-muted/40 rounded-md">
            <p className="text-xs text-muted-foreground">
              Logged in as{" "}
              <span className="font-medium text-foreground">{user.email || user.id}</span>
            </p>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
