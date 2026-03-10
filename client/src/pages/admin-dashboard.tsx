import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AdminShell from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
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
  Library,
  Type,
  Layers,
  Image,
  Film,
  Box,
  Palette,
} from "lucide-react";
import { formatCurrency, formatTrend } from "@/lib/admin-utils";

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
    <Card className="hover-elevate overflow-hidden">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground break-words">{title}</p>
            <p className="text-lg sm:text-2xl font-bold mt-1 break-words" data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 break-words">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {trend >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500 flex-shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500 flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    trend >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {formatTrend(trend)}
                </span>
                {trendLabel && (
                  <span className="text-xs text-muted-foreground truncate">
                    {trendLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    healthy: { label: "Healthy", color: "bg-green-500/10 text-green-600 border-green-500/20" },
    degraded: { label: "Degraded", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
    down: { label: "Down", color: "bg-red-500/10 text-red-600 border-red-500/20" },
    not_configured: { label: "Not Configured", color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  };
  const { label, color } = config[status] || config.down;
  return (
    <Badge variant="outline" className={color}>
      {status === "healthy" && <CheckCircle className="w-3 h-3 mr-1" />}
      {status === "degraded" && <AlertCircle className="w-3 h-3 mr-1" />}
      {status === "down" && <AlertCircle className="w-3 h-3 mr-1" />}
      {status === "not_configured" && <AlertCircle className="w-3 h-3 mr-1" />}
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
  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/admin/dashboard/metrics"],
  });

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Business metrics & health"
      icon={LayoutDashboard}
      actions={
        <>
          <Button asChild variant="outline" size="icon" className="qr-touch-48 sm:hidden">
            <Link href="/admin/health">
              <Activity className="h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="qr-touch-48 hidden sm:flex">
            <Link href="/admin/health">
              <Activity className="h-4 w-4 mr-2" />
              System Health
            </Link>
          </Button>
        </>
      }
    >
        {isLoading ? (
          <div className="qr-admin-grid qr-admin-grid--4">
            {[...Array(8)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="qr-admin-grid qr-admin-grid--4 mb-6">
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

            <div className="qr-admin-grid qr-admin-grid--4 mb-6">
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

            <div className="qr-admin-grid qr-admin-grid--2">
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

            <div className="qr-admin-quicklinks">
              <Link href="/admin/orders" className="qr-admin-quicklink" data-testid="link-manage-orders">
                <ShoppingCart className="qr-admin-quicklink__icon" />
                <span>Manage Orders</span>
              </Link>
              <Link href="/admin/customers" className="qr-admin-quicklink" data-testid="link-view-customers">
                <Users className="qr-admin-quicklink__icon" />
                <span>View Customers</span>
              </Link>
              <Link href="/admin/coupons" className="qr-admin-quicklink" data-testid="link-promo-codes">
                <DollarSign className="qr-admin-quicklink__icon" />
                <span>Promo Codes</span>
              </Link>
              <Link href="/admin/products" className="qr-admin-quicklink" data-testid="link-products">
                <Package className="qr-admin-quicklink__icon" />
                <span>Products</span>
              </Link>
              <Link href="/admin/store-builder" className="qr-admin-quicklink" data-testid="link-store-builder">
                <Package className="qr-admin-quicklink__icon" />
                <span>Store Builder</span>
              </Link>
              <Link href="/admin/store-library" className="qr-admin-quicklink" data-testid="link-store-library">
                <Library className="qr-admin-quicklink__icon" />
                <span>Store Library</span>
              </Link>
              <Link href="/admin/fonts" className="qr-admin-quicklink" data-testid="link-font-management">
                <Type className="qr-admin-quicklink__icon" />
                <span>Font Management</span>
              </Link>
              <Link href="/admin/dynamics" className="qr-admin-quicklink" data-testid="link-dynamics">
                <Layers className="qr-admin-quicklink__icon" />
                <span>QR Dynamics</span>
              </Link>
              <Link href="/admin/ar-demo" className="qr-admin-quicklink" data-testid="link-ar-demo">
                <Box className="qr-admin-quicklink__icon" />
                <span>AR Demo</span>
              </Link>
            </div>

          </>
        )}
    </AdminShell>
  );
}
