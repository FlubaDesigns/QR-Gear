import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  LayoutDashboard,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
} from "lucide-react";

interface DashboardMetrics {
  revenue: {
    today: number;
    week: number;
    month: number;
    trend: number;
  };
  orders: {
    total: number;
    pending: number;
    inProduction: number;
    shipped: number;
    trend: number;
  };
  customers: {
    total: number;
    newThisWeek: number;
    returning: number;
  };
  products: {
    active: number;
    lowStock: number;
    syncErrors: number;
  };
  health: {
    printify: "healthy" | "degraded" | "down";
    stripe: "healthy" | "degraded" | "down";
    lastCheck: string;
  };
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
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold mt-1" data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${
                    trend >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {trend >= 0 ? "+" : ""}
                  {trend}%
                </span>
                {trendLabel && (
                  <span className="text-xs text-muted-foreground">
                    {trendLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "healthy" | "degraded" | "down" }) {
  const config = {
    healthy: { label: "Healthy", color: "bg-green-500/10 text-green-600 border-green-500/20" },
    degraded: { label: "Degraded", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    down: { label: "Down", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  };
  const { label, color } = config[status];
  return (
    <Badge variant="outline" className={color}>
      {status === "healthy" && <CheckCircle className="w-3 h-3 mr-1" />}
      {status === "degraded" && <AlertCircle className="w-3 h-3 mr-1" />}
      {status === "down" && <AlertCircle className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32 mt-2" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/admin/dashboard/metrics"],
  });

  return (
    <div className="min-h-screen">
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    Dashboard
                  </h1>
                  <p className="text-xs text-slate-400">
                    Business metrics & health
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="border-slate-600 text-slate-300">
                <Link href="/admin/health">
                  <Activity className="h-4 w-4 mr-2" />
                  System Health
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        <nav className="mb-4 text-sm" aria-label="Breadcrumb">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">
            Admin
          </Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-foreground font-medium" aria-current="page">
            Dashboard
          </span>
        </nav>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Today's Revenue"
                value={`$${(metrics?.revenue.today || 0).toFixed(2)}`}
                icon={DollarSign}
                trend={metrics?.revenue.trend}
                trendLabel="vs yesterday"
              />
              <MetricCard
                title="Weekly Revenue"
                value={`$${(metrics?.revenue.week || 0).toFixed(2)}`}
                icon={DollarSign}
              />
              <MetricCard
                title="Monthly Revenue"
                value={`$${(metrics?.revenue.month || 0).toFixed(2)}`}
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Pending Orders"
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
                title="Total Customers"
                value={metrics?.customers.total || 0}
                subtitle={`${metrics?.customers.newThisWeek || 0} new this week`}
                icon={Users}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">Printify</span>
                    <StatusBadge status={metrics?.health.printify || "healthy"} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">Stripe</span>
                    <StatusBadge status={metrics?.health.stripe || "healthy"} />
                  </div>
                  {metrics?.health.lastCheck && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Last checked: {new Date(metrics.health.lastCheck).toLocaleTimeString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Products
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span>Active Products</span>
                    <Badge variant="secondary">{metrics?.products.active || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span>Low Stock Alerts</span>
                    <Badge
                      variant="outline"
                      className={
                        (metrics?.products.lowStock || 0) > 0
                          ? "bg-yellow-500/10 text-yellow-600"
                          : ""
                      }
                    >
                      {metrics?.products.lowStock || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span>Sync Errors</span>
                    <Badge
                      variant="outline"
                      className={
                        (metrics?.products.syncErrors || 0) > 0
                          ? "bg-red-500/10 text-red-600"
                          : ""
                      }
                    >
                      {metrics?.products.syncErrors || 0}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Link
                href="/admin/orders"
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover-elevate transition-all"
                data-testid="link-manage-orders"
              >
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="font-medium">Manage Orders</span>
              </Link>
              <Link
                href="/admin/customers"
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover-elevate transition-all"
                data-testid="link-view-customers"
              >
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">View Customers</span>
              </Link>
              <Link
                href="/admin/coupons"
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover-elevate transition-all"
                data-testid="link-promo-codes"
              >
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="font-medium">Promo Codes</span>
              </Link>
              <Link
                href="/admin/products"
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover-elevate transition-all"
                data-testid="link-products"
              >
                <Package className="h-5 w-5 text-primary" />
                <span className="font-medium">Products</span>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
