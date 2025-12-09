import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Package, Clock, Truck, CheckCircle, RefreshCw, ExternalLink, ShoppingCart, DollarSign, TrendingUp, Plus, Loader2, History, Eye, LogOut, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import type { Order, OrderItem, CartItem, Product, BrowsingHistory } from "@shared/schema";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

interface DashboardStats {
  totalOrders: number;
  totalSpent: number;
  pendingShipments: number;
  cartItemsCount: number;
}

export default function Account() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const userId = user?.id;

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/orders"],
    enabled: !!userId,
  });

  const { data: cartItems, isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: !!userId,
  });

  const { data: browsingHistory, isLoading: historyLoading } = useQuery<BrowsingHistory[]>({
    queryKey: ["/api/browsing-history"],
    enabled: !!userId,
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const stats: DashboardStats = {
    totalOrders: orders?.length || 0,
    totalSpent: orders?.reduce((sum, order) => sum + Number(order.totalAmount), 0) || 0,
    pendingShipments: orders?.filter(o => o.status === "processing" || o.status === "pending").length || 0,
    cartItemsCount: cartItems?.length || 0,
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

  const getProductById = (productId: string) => {
    return products?.find(p => p.id === productId);
  };

  const getSuggestedProducts = () => {
    if (!browsingHistory || !products) return products?.slice(0, 4) || [];
    const viewedIds = new Set(browsingHistory.map(h => h.productId));
    const viewedCategories = new Set(
      browsingHistory
        .map(h => getProductById(h.productId)?.category)
        .filter(Boolean)
    );
    const suggestions = products.filter(p => 
      !viewedIds.has(p.id) && viewedCategories.has(p.category)
    );
    return suggestions.length > 0 ? suggestions.slice(0, 4) : products.slice(0, 4);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        <div className="max-w-md mx-auto mt-20">
          <Card className="glass-card">
            <CardHeader className="text-center">
              <UserIcon className="w-16 h-16 mx-auto text-primary mb-4" />
              <CardTitle className="text-2xl">Welcome to QR Gear</CardTitle>
              <p className="text-muted-foreground mt-2">
                Sign in to view your orders, cart, and browsing history
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full btn btn-gold gap-2" 
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login"
              >
                <UserIcon className="w-4 h-4" />
                Sign In
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Sign in with Google, GitHub, or email
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isLoading = ordersLoading || cartLoading || historyLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback>
                  {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Welcome, {user?.firstName || user?.email?.split('@')[0] || 'User'}!
                </h1>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/creator">
                <Button className="btn btn-gold gap-2" data-testid="button-create-new">
                  <Plus className="w-4 h-4" />
                  Create New Design
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card" data-testid="stat-total-orders">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="stat-total-spent">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">${stats.totalSpent.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="stat-pending-shipments">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.pendingShipments}</div>
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="stat-cart-items">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Cart</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.cartItemsCount}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="glass-card p-1">
            <TabsTrigger value="orders" className="gap-2" data-testid="tab-orders">
              <Package className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="cart" className="gap-2" data-testid="tab-cart">
              <ShoppingCart className="w-4 h-4" />
              Cart ({stats.cartItemsCount})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
              <History className="w-4 h-4" />
              Recently Viewed
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-2" data-testid="tab-suggestions">
              <TrendingUp className="w-4 h-4" />
              For You
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {isLoading ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </CardContent>
              </Card>
            ) : !orders || orders.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2 text-foreground">No orders yet</h2>
                  <p className="text-muted-foreground mb-6">
                    Start creating custom QR code merchandise!
                  </p>
                  <Link href="/creator">
                    <Button className="btn btn-gold" data-testid="button-start-creating">
                      Start Creating
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 5).map((order) => (
                  <Card key={order.id} className="glass-card" data-testid={`card-order-${order.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Order #{order.id.slice(-8).toUpperCase()}</CardTitle>
                            <Badge variant={getStatusColor(order.status)} className="gap-1">
                              {getStatusIcon(order.status)}
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Placed {format(new Date(order.createdAt), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-foreground">${order.totalAmount}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.items?.length || 0} items
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    {order.trackingNumber && (
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="w-4 h-4 text-primary" />
                          <span>Tracking: {order.trackingNumber}</span>
                          <Button variant="ghost" size="sm" className="ml-auto gap-1">
                            <ExternalLink className="w-3 h-3" />
                            Track
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cart" className="space-y-4">
            {cartLoading ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </CardContent>
              </Card>
            ) : !cartItems || cartItems.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2 text-foreground">Your cart is empty</h2>
                  <p className="text-muted-foreground mb-6">
                    Add some custom QR products to your cart!
                  </p>
                  <Link href="/products">
                    <Button className="btn btn-gold" data-testid="button-browse-products">
                      Browse Products
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const product = getProductById(item.productId);
                  const customization = item.customization as any;
                  return (
                    <Card key={item.id} className="glass-card" data-testid={`card-cart-${item.id}`}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          {product?.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{product?.name || 'Product'}</p>
                          <p className="text-sm text-muted-foreground">
                            {customization?.placement && `Placement: ${customization.placement}`}
                          </p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">${Number(item.price).toFixed(2)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total</span>
                      <span className="text-xl font-bold">
                        ${cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0).toFixed(2)}
                      </span>
                    </div>
                    <Button className="w-full btn btn-gold mt-4" data-testid="button-checkout">
                      Proceed to Checkout
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {historyLoading ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </CardContent>
              </Card>
            ) : !browsingHistory || browsingHistory.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <Eye className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2 text-foreground">No browsing history</h2>
                  <p className="text-muted-foreground mb-6">
                    Products you view will appear here
                  </p>
                  <Link href="/products">
                    <Button className="btn btn-gold" data-testid="button-explore-products">
                      Explore Products
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {browsingHistory.slice(0, 8).map((entry) => {
                  const product = getProductById(entry.productId);
                  if (!product) return null;
                  return (
                    <Card key={entry.id} className="glass-card hover-elevate" data-testid={`card-history-${entry.id}`}>
                      <CardContent className="p-4">
                        <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-sm text-muted-foreground">${product.basePrice}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Viewed {format(new Date(entry.viewedAt), "MMM dd")}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {getSuggestedProducts().map((product) => (
                <Card key={product.id} className="glass-card hover-elevate" data-testid={`card-suggestion-${product.id}`}>
                  <CardContent className="p-4">
                    <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground">${product.basePrice}</p>
                    <Badge variant="outline" className="mt-2">{product.category}</Badge>
                    <Link href="/creator">
                      <Button className="w-full mt-3" variant="outline" size="sm" data-testid={`button-customize-${product.id}`}>
                        Customize
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
