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
  Zap,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string;
  title: string;
  reason: string;
  priority: "critical" | "important" | "next" | "optional";
  category: "system" | "email" | "marketplace" | "sell" | "banking" | "place";
  href: string;
  count?: number;
}

interface QueueResponse {
  items: QueueItem[];
  generatedAt: string;
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
    dotClass: "bg-red-500",
  },
  important: {
    label: "Important",
    icon: AlertCircle,
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dotClass: "bg-amber-500",
  },
  next: {
    label: "Next",
    icon: ChevronRight,
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    dotClass: "bg-blue-500",
  },
  optional: {
    label: "Optional",
    icon: Info,
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  system: "System",
  email: "Email",
  marketplace: "Marketplace",
  sell: "Sell",
  banking: "Banking",
  place: "Place",
};

// ─── Queue card ───────────────────────────────────────────────────────────────

function QueueCard({ item }: { item: QueueItem }) {
  const [, navigate] = useLocation();
  const cfg = PRIORITY_CONFIG[item.priority];
  const Icon = cfg.icon;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-md bg-card border border-border hover-elevate active-elevate-2 cursor-pointer"
      onClick={() => navigate(item.href)}
      data-testid={`queue-item-${item.id}`}
    >
      <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium leading-snug">{item.title}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {item.count !== undefined && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                {item.count}
              </Badge>
            )}
            <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${cfg.badgeClass}`}>
              <Icon className="w-2.5 h-2.5 mr-1" />
              {cfg.label}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.reason}</p>
        <span className="text-xs text-muted-foreground/60 mt-1 inline-block">
          {CATEGORY_LABELS[item.category]}
        </span>
      </div>
    </div>
  );
}

// ─── Priority queue section ───────────────────────────────────────────────────

function PriorityQueue() {
  const { data, isLoading, refetch, isRefetching } = useQuery<QueueResponse>({
    queryKey: ["/api/admin/dashboard/queue"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/queue");
      return res.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const criticalCount = items.filter((i) => i.priority === "critical").length;

  return (
    <div className="space-y-2" data-testid="section-priority-queue">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Priority Now</h2>
          {criticalCount > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs px-1.5 py-0 h-5">
              {criticalCount} critical
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          data-testid="button-refresh-queue"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking system signals…
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 p-3 rounded-md bg-card border border-border">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-muted-foreground">All clear — no items need attention right now.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <QueueCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {data?.generatedAt && (
        <p className="text-xs text-muted-foreground/50">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
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
  { label: "Email Health", icon: Mail, href: "/admin/email-health" },
  { label: "System", icon: Activity, href: "/admin/health" },
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
  { title: "Templates", description: "Product category templates", icon: Tag, href: "/admin/categories" },
  { title: "Partners", description: "Partner stores and product lines", icon: Store, href: "/admin/partners" },
  { title: "Marketplaces", description: "Etsy, eBay, Amazon surfaces", icon: Globe, href: "/admin/marketplaces" },
  { title: "External Sites", description: "Embedded stores and affiliate payouts", icon: Globe, href: "/admin/external-sites" },
  { title: "System Health", description: "Provider status and system health", icon: Activity, href: "/admin/health" },
  { title: "Email Templates", description: "Email templates and logs", icon: Mail, href: "/admin/email-templates" },
  { title: "Email Health", description: "Email system health and queue", icon: Mail, href: "/admin/email-health" },
  { title: "Settings", description: "API keys and integrations", icon: Settings, href: "/admin/settings" },
  { title: "Admin Manual", description: "Complete management guide", icon: Book, href: "/admin/manual" },
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
