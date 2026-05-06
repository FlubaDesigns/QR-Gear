import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Hammer,
  MapPin,
  ShoppingCart,
  Settings,
  Layers,
  Store,
  Users,
  BookOpen,
  FolderOpen,
  Plus,
  Activity,
  Zap,
  Play,
  Clock,
  Bookmark,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Trash2,
  LayoutGrid,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AdminShell from "@/components/AdminShell";
import { adminFetch } from "@/lib/adminFetch";
import { formatCurrency, formatTrend } from "@/lib/admin-utils";
import { queryClient } from "@/lib/queryClient";

interface DashboardMetrics {
  revenue: { today: number; week: number; month: number; trend: number };
  orders: { total: number; pending: number; inProduction: number; shipped: number; trend: number };
  customers: { total: number; newThisWeek: number; returning: number };
  products: { active: number; lowStock: number; syncErrors: number };
  health: { printify: "healthy" | "degraded" | "down"; stripe: "healthy" | "degraded" | "down"; lastCheck: string };
}

interface BuildSession {
  id: string;
  draftName?: string;
  status: string;
  working?: { title?: string };
  lastActiveAt?: string | null;
  updatedAt?: string | null;
}

interface QuickAction {
  label: string;
  description: string;
  icon: typeof Hammer;
  href: string;
  primary?: boolean;
}

const quickActions: QuickAction[] = [
  { label: "New Product", description: "Open builder and start fresh", icon: Plus, href: "/admin/products", primary: true },
  { label: "Load Template", description: "Resume from a saved template", icon: FolderOpen, href: "/admin/products" },
  { label: "Library", description: "Browse images and graphics", icon: Layers, href: "/admin/library" },
  { label: "Store Builder", description: "Configure stores and channels", icon: Store, href: "/admin/store-builder" },
  { label: "Store Planner", description: "Product configs and store links", icon: LayoutGrid, href: "/admin/store-planner" },
  { label: "Orders", description: "Review pending and recent", icon: ShoppingCart, href: "/admin/orders" },
  { label: "Customers", description: "View registered members", icon: Users, href: "/admin/customers" },
];

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof DollarSign;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold mt-0.5" data-testid={`metric-${title.toLowerCase().replace(/\s+/g, "-")}`}>
              {value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {trend >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500 flex-shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500 flex-shrink-0" />
                )}
                <span className={`text-xs font-medium ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatTrend(trend)}
                </span>
                {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
              </div>
            )}
          </div>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-3 w-28 mt-2" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: "healthy" | "degraded" | "down" | string }) {
  if (status === "healthy") return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
  return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
}

function MetricsSection() {
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/admin/dashboard/metrics"],
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center gap-1.5 mb-3">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metrics</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metrics</h2>
        <div className="flex items-center gap-2 ml-auto">
          <StatusDot status={metrics?.health.printify || "healthy"} />
          <span className="text-[10px] text-muted-foreground">Printify</span>
          <StatusDot status={metrics?.health.stripe || "healthy"} />
          <span className="text-[10px] text-muted-foreground">Stripe</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-2">
        <MetricCard
          title="Today's Revenue"
          value={formatCurrency(metrics?.revenue.today || 0)}
          icon={DollarSign}
          trend={metrics?.revenue.trend}
          trendLabel="vs yesterday"
        />
        <MetricCard
          title="Weekly Revenue"
          value={formatCurrency(metrics?.revenue.week || 0)}
          icon={DollarSign}
        />
        <MetricCard
          title="Monthly Revenue"
          value={formatCurrency(metrics?.revenue.month || 0)}
          icon={DollarSign}
        />
        <MetricCard
          title="Total Orders"
          value={metrics?.orders.total || 0}
          icon={ShoppingCart}
          trend={metrics?.orders.trend}
          trendLabel="this week"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard
          title="Pending"
          value={metrics?.orders.pending || 0}
          subtitle="Awaiting processing"
          icon={Clock}
        />
        <MetricCard
          title="In Production"
          value={metrics?.orders.inProduction || 0}
          subtitle="Being printed"
          icon={Package}
        />
        <MetricCard
          title="Shipped"
          value={metrics?.orders.shipped || 0}
          subtitle="In transit"
          icon={Package}
        />
        <MetricCard
          title="Customers"
          value={metrics?.customers.total || 0}
          subtitle={`${metrics?.customers.newThisWeek || 0} new this week`}
          icon={Users}
        />
      </div>
    </section>
  );
}

function InProgressSection() {
  const [, navigate] = useLocation();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/build-sessions", "working"],
    queryFn: () => adminFetch<any>("/build-sessions?status=working").catch(() => ({ sessions: [] })),
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) =>
      adminFetch(`/build-sessions/${sessionId}/abandon`, { method: "POST" }),
    onSuccess: () => {
      setConfirmingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/build-sessions", "working"] });
    },
  });

  const sessions: BuildSession[] = data?.sessions || [];

  if (isLoading || sessions.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <Bookmark className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In Progress</h2>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-0.5">{sessions.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {sessions.slice(0, 8).map((session) => {
          const lastActive = session.lastActiveAt || session.updatedAt;
          const displayName = session.draftName || session.working?.title || "Unnamed draft";
          const isUnnamed = !session.draftName;
          const isConfirming = confirmingDelete === session.id;
          const isDeleting = deleteMutation.isPending && confirmingDelete === session.id;
          return (
            <div
              key={session.id}
              className="flex items-center gap-3 p-3 rounded-md border border-border bg-card"
              data-testid={`run-draft-${session.id}`}
            >
              <div className="flex-shrink-0 h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Bookmark className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium leading-tight truncate ${isUnnamed ? "text-muted-foreground italic" : ""}`}>
                  {displayName}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {session.draftName && session.working?.title && (
                    <p className="text-xs text-muted-foreground truncate">{session.working.title}</p>
                  )}
                  {isUnnamed && (
                    <span className="text-xs text-muted-foreground">Not yet named</span>
                  )}
                  {lastActive && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(lastActive)}
                    </span>
                  )}
                </div>
              </div>
              {isConfirming ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">Delete?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(session.id)}
                    disabled={isDeleting}
                    data-testid={`run-draft-delete-confirm-${session.id}`}
                  >
                    {isDeleting ? "Deleting…" : "Yes"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(null)}
                    disabled={isDeleting}
                    data-testid={`run-draft-delete-cancel-${session.id}`}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(session.id)}
                    data-testid={`run-draft-delete-${session.id}`}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/products?resume=${session.id}`)}
                    data-testid={`run-draft-resume-${session.id}`}
                    className="gap-1.5"
                  >
                    <Play className="h-3 w-3" />
                    Resume
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminRun() {
  const [, navigate] = useLocation();

  return (
    <AdminShell
      title="Run"
      subtitle="Operating cockpit"
      icon={Zap}
      hideBack
      noPadding={false}
    >
      <div className="space-y-6">
        <MetricsSection />

        <InProgressSection />

        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.label}
                  className={`cursor-pointer hover-elevate transition-all ${action.primary ? "border-primary/30 bg-primary/5" : ""}`}
                  onClick={() => navigate(action.href)}
                  data-testid={`run-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <Icon className={`h-4 w-4 ${action.primary ? "text-primary" : "text-muted-foreground"}`} />
                    <p className={`text-sm font-medium leading-tight ${action.primary ? "text-primary" : ""}`}>
                      {action.label}
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">{action.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate("/admin/manual")}
              className="flex items-center gap-2 p-3 rounded-md text-left border border-border hover-elevate transition-colors bg-card"
              data-testid="run-link-manual"
            >
              <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium">Manual</span>
            </button>
            <button
              onClick={() => navigate("/admin/health")}
              className="flex items-center gap-2 p-3 rounded-md text-left border border-border hover-elevate transition-colors bg-card"
              data-testid="run-link-health"
            >
              <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium">Health</span>
            </button>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
