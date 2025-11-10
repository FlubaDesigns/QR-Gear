import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Clock, Truck, CheckCircle, RefreshCw, ExternalLink, ShoppingCart, DollarSign, TrendingUp, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import type { Order, OrderItem } from "@shared/schema";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

interface DashboardStats {
  totalOrders: number;
  totalSpent: number;
  pendingShipments: number;
  recentOrders: number;
}

export default function Account() {
  const { user, loading: authLoading } = useAuth();

  // TODO: Uncomment when /login page is created
  // const [, setLocation] = useLocation();
  // useEffect(() => {
  //   if (!authLoading && !user) {
  //     setLocation("/login");
  //   }
  // }, [user, authLoading, setLocation]);

  const userId = user?.uid || "demo-user-123";

  const { data: orders, isLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders", userId],
    enabled: !!user,
  });

  const stats: DashboardStats = {
    totalOrders: orders?.length || 0,
    totalSpent: orders?.reduce((sum, order) => sum + Number(order.totalAmount), 0) || 0,
    pendingShipments: orders?.filter(o => o.status === "processing" || o.status === "pending").length || 0,
    recentOrders: orders?.filter(o => {
      const orderDate = new Date(o.createdAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return orderDate >= thirtyDaysAgo;
    }).length || 0,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "shipped":
        return <Truck className="w-4 h-4 text-blue-600" />;
      case "processing":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <Package className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "delivered":
        return "default";
      case "shipped":
        return "secondary";
      case "processing":
        return "outline";
      default:
        return "outline";
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              {authLoading ? "Checking authentication..." : "Loading dashboard..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Track orders, manage designs, and reorder favorites
              </p>
            </div>
            <Button className="btn btn-gold gap-2" data-testid="button-create-new">
              <Plus className="w-4 h-4" />
              Create New Design
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card" data-testid="stat-total-orders">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.recentOrders} in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="stat-total-spent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">${stats.totalSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Lifetime value
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="stat-pending-shipments">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Shipments</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.pendingShipments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Orders in progress
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="stat-saved-designs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saved Designs</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Ready to order
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Recent Orders</h2>
              <Button variant="ghost" size="sm" data-testid="button-view-all-orders">
                View All
              </Button>
            </div>

{!orders || orders.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2 text-foreground">No orders yet</h2>
                  <p className="text-muted-foreground mb-6">
                    Start creating custom QR code merchandise!
                  </p>
                  <Button className="btn btn-gold" data-testid="button-start-creating">
                    Start Creating
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 5).map((order) => (
              <Card key={order.id} className="glass-card hover-elevate" data-testid={`card-order-${order.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">Order #{order.id.slice(-8).toUpperCase()}</CardTitle>
                        <Badge variant={getStatusColor(order.status)} className="gap-1" data-testid={`badge-status-${order.id}`}>
                          {getStatusIcon(order.status)}
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Placed {format(new Date(order.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground" data-testid={`text-total-${order.id}`}>
                        ${order.totalAmount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {order.trackingNumber && (
                    <div className="glass-card p-3 rounded-lg flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Tracking Number:</span>
                        <code className="text-sm bg-muted px-2 py-1 rounded" data-testid={`text-tracking-${order.id}`}>
                          {order.trackingNumber}
                        </code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        data-testid={`button-track-${order.id}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Track Package
                      </Button>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-foreground">Items Ordered:</h4>
                    <div className="space-y-2">
                      {order.items.map((item) => {
                        const customization = item.customization as any;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                            data-testid={`item-${item.id}`}
                          >
                            <div className="w-12 h-12 bg-background rounded flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground" data-testid={`text-item-product-${item.id}`}>
                                {customization?.productName || "Custom QR Product"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Qty: {item.quantity} • ${item.price} each
                              </p>
                              {customization?.qrContent && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  QR: {customization.qrContent.substring(0, 40)}...
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-foreground" data-testid={`text-item-total-${item.id}`}>
                                ${(Number(item.price) * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        data-testid={`button-reorder-${order.id}`}
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reorder
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-view-details-${order.id}`}
                      >
                        View Details
                      </Button>
                    </div>
                    {(() => {
                      const addr = order.shippingAddress;
                      if (addr && typeof addr === 'object' && 'city' in addr && 'state' in addr) {
                        return (
                          <div className="text-xs text-muted-foreground">
                            Ships to: {String(addr.city)}, {String(addr.state)}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </CardContent>
              </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Quick Actions</h2>
            
            <Card className="glass-card">
              <CardContent className="p-4 space-y-3">
                <Button className="w-full btn gap-2" variant="outline" data-testid="button-track-orders">
                  <Truck className="w-4 h-4" />
                  Track All Orders
                </Button>
                <Button className="w-full btn gap-2" variant="outline" data-testid="button-saved-designs">
                  <Package className="w-4 h-4" />
                  My Saved Designs
                </Button>
                <Button className="w-full btn gap-2" variant="outline" data-testid="button-reorder-favorites">
                  <RefreshCw className="w-4 h-4" />
                  Reorder Favorites
                </Button>
                <Separator />
                <Button className="w-full btn btn-gold gap-2" data-testid="button-browse-products">
                  <ShoppingCart className="w-4 h-4" />
                  Browse Products
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Button variant="ghost" className="w-full justify-start p-2 h-auto" data-testid="button-contact-support">
                  <span className="text-left">Contact Support</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start p-2 h-auto" data-testid="button-faq">
                  <span className="text-left">Visit FAQ</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start p-2 h-auto" data-testid="button-shipping-info">
                  <span className="text-left">Shipping Information</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
