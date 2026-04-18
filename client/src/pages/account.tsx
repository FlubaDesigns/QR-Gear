import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Package, Clock, Truck, CheckCircle, RefreshCw, ExternalLink, ShoppingCart, DollarSign, TrendingUp, Plus, Loader2, History, Eye, LogOut, User as UserIcon, Palette, Trash2, Edit, QrCode, Upload, Copy, Link2, Zap, Shield } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import SEO from "@/components/SEO";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order, OrderItem, CartItem, Product, BrowsingHistory, QrDesign, DynamicPage } from "@shared/schema";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

function getTrackingUrl(carrier: string | null | undefined, trackingNumber: string): string {
  const carrierLower = (carrier || '').toLowerCase();
  
  if (carrierLower.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  }
  if (carrierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  }
  if (carrierLower.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  }
  if (carrierLower.includes('dhl')) {
    return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`;
  }
  // Default to Google search for tracking
  return `https://www.google.com/search?q=${encodeURIComponent(trackingNumber + ' tracking')}`;
}

interface DynamicPageWithImage extends DynamicPage {
  activeImage?: {
    url: string;
    title: string | null;
  } | null;
}

interface DashboardStats {
  totalOrders: number;
  totalSpent: number;
  pendingShipments: number;
  cartItemsCount: number;
}

export default function Account() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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

  const { data: savedDesigns, isLoading: designsLoading } = useQuery<QrDesign[]>({
    queryKey: ["/api/designs"],
    enabled: !!userId,
  });

  const { data: dynamicPages, isLoading: dynamicPagesLoading } = useQuery<DynamicPageWithImage[]>({
    queryKey: ["/api/dynamic-pages"],
    enabled: !!userId,
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: claimedData, isLoading: claimedLoading } = useQuery<{ instances: any[] }>({
    queryKey: ["/api/claimed-instances"],
    enabled: !!userId,
  });
  const claimedInstances = claimedData?.instances || [];

  const deleteDesignMutation = useMutation({
    mutationFn: async (designId: string) => {
      await apiRequest("DELETE", `/api/designs/${designId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
      toast({
        title: "Design deleted",
        description: "Your saved design has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete design. Please try again.",
        variant: "destructive",
      });
    },
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
              <Link href="/login">
                <Button 
                  className="w-full btn btn-gold gap-2" 
                  data-testid="button-login"
                >
                  <UserIcon className="w-4 h-4" />
                  Sign In
                </Button>
              </Link>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <SEO 
        title="My Account | QR Gear"
        description="Manage your QR Gear account, view order history, track shipments, and manage your saved designs."
        keywords="QR Gear account, order history, manage designs"
      />
<div className="max-w-6xl mx-auto space-y-6 p-6">
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
              <Link href="/build">
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
          <TabsList className="glass-card p-1 flex-wrap">
            <TabsTrigger value="orders" className="gap-2" data-testid="tab-orders">
              <Package className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="designs" className="gap-2" data-testid="tab-designs">
              <Palette className="w-4 h-4" />
              Saved Designs
            </TabsTrigger>
            <TabsTrigger value="cart" className="gap-2" data-testid="tab-cart">
              <ShoppingCart className="w-4 h-4" />
              Cart ({stats.cartItemsCount})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
              <History className="w-4 h-4" />
              Recently Viewed
            </TabsTrigger>
            <TabsTrigger value="dynamic" className="gap-2" data-testid="tab-dynamic">
              <QrCode className="w-4 h-4" />
              Dynamic Pages
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-2" data-testid="tab-suggestions">
              <TrendingUp className="w-4 h-4" />
              For You
            </TabsTrigger>
            <TabsTrigger value="my-qr-items" className="gap-2" data-testid="tab-my-qr-items">
              <Zap className="w-4 h-4" />
              My QR Items
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
                  <Link href="/build">
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
                    <CardContent className="pt-0 space-y-3">
                      {order.trackingNumber && (
                        <div className="flex items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg flex-wrap">
                          <Truck className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{order.carrier || 'Shipping'}</span>
                            <span className="text-muted-foreground ml-2 break-all">{order.trackingNumber}</span>
                          </div>
                          <a 
                            href={getTrackingUrl(order.carrier, order.trackingNumber)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-auto flex-shrink-0"
                          >
                            <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-track-${order.id}`}>
                              <ExternalLink className="w-3 h-3" />
                              Track Package
                            </Button>
                          </a>
                        </div>
                      )}
                      
                      {order.items && order.items.length > 0 && (
                        <div className="space-y-2">
                          {order.items.slice(0, 3).map((item, idx) => {
                            const customization = item.customization as Record<string, unknown>;
                            const productName = (customization?.productName as string) || "Custom QR Product";
                            const size = customization?.productSize as string;
                            const color = customization?.productColor as string;
                            return (
                              <div key={idx} className="flex items-center gap-3 text-sm border-l-2 border-primary/20 pl-3">
                                <span className="font-medium">{productName}</span>
                                {size && <Badge variant="outline" className="text-xs">{size}</Badge>}
                                {color && <Badge variant="outline" className="text-xs">{color}</Badge>}
                                <span className="text-muted-foreground ml-auto">x{item.quantity}</span>
                              </div>
                            );
                          })}
                          {order.items.length > 3 && (
                            <p className="text-xs text-muted-foreground pl-3">
                              +{order.items.length - 3} more item(s)
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <Link href="/build">
                          <Button variant="outline" size="sm" className="gap-1" data-testid={`button-reorder-${order.id}`}>
                            <RefreshCw className="w-3 h-3" />
                            Reorder Similar
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="designs" className="space-y-4">
            {designsLoading ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </CardContent>
              </Card>
            ) : !savedDesigns || savedDesigns.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <Palette className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2 text-foreground">No saved designs</h2>
                  <p className="text-muted-foreground mb-6">
                    Save your QR designs to reorder them later
                  </p>
                  <Link href="/build">
                    <Button className="btn btn-gold" data-testid="button-create-design">
                      Create a Design
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedDesigns.map((design) => {
                  const product = getProductById(design.productId || "");
                  const qrStyle = design.qrStyle as { color?: string; backgroundColor?: string } | null;
                  return (
                    <Card key={design.id} className="glass-card" data-testid={`card-design-${design.id}`}>
                      <CardContent className="p-4">
                        <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                          {design.previewUrl ? (
                            <img src={design.previewUrl} alt={design.name} className="w-full h-full object-cover" />
                          ) : (
                            <div 
                              className="w-24 h-24 rounded-lg flex items-center justify-center border"
                              style={{ 
                                backgroundColor: qrStyle?.backgroundColor || '#FFFFFF',
                              }}
                            >
                              <Palette className="w-12 h-12" style={{ color: qrStyle?.color || '#000000' }} />
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="font-medium text-foreground truncate">{design.name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">{design.qrType}</Badge>
                            <Badge variant="secondary">{design.placement}</Badge>
                            {design.madeInUSA && (
                              <Badge variant="default" className="gap-1">
                                USA
                              </Badge>
                            )}
                          </div>
                          {product && (
                            <p className="text-sm text-muted-foreground">{product.name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Created {format(new Date(design.createdAt), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Link href="/build" className="flex-1">
                            <Button variant="outline" className="w-full gap-1" size="sm" data-testid={`button-reorder-${design.id}`}>
                              <Edit className="w-3 h-3" />
                              Reorder
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => deleteDesignMutation.mutate(design.id)}
                            disabled={deleteDesignMutation.isPending}
                            data-testid={`button-delete-design-${design.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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

          <TabsContent value="dynamic" className="space-y-4">
            {dynamicPagesLoading ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </CardContent>
              </Card>
            ) : !dynamicPages || dynamicPages.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <QrCode className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2 text-foreground">No Dynamic QR Pages</h2>
                  <p className="text-muted-foreground mb-6">
                    Create a Dynamic QR product to get a page you can update anytime!
                  </p>
                  <Link href="/build">
                    <Button className="btn btn-gold" data-testid="button-create-dynamic">
                      Create Dynamic QR
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dynamicPages.map((page) => {
                  const pageUrl = `${window.location.origin}/dynamic/${page.slug}`;
                  const isExpired = page.expiresAt && new Date(page.expiresAt) < new Date();
                  
                  return (
                    <Card key={page.id} className="glass-card" data-testid={`card-dynamic-${page.id}`}>
                      <CardContent className="p-4">
                        <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                          {page.activeImage?.url ? (
                            <img 
                              src={page.activeImage.url} 
                              alt={page.title} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="text-center text-muted-foreground p-4">
                              <Upload className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-sm">No image uploaded</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground truncate">{page.title}</p>
                            <Badge variant={isExpired ? "destructive" : page.status === "active" ? "default" : "secondary"}>
                              {isExpired ? "Expired" : page.status}
                            </Badge>
                          </div>
                          {page.description && (
                            <p className="text-sm text-muted-foreground truncate">{page.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Link2 className="w-3 h-3" />
                            <span className="truncate">/dynamic/{page.slug}</span>
                          </div>
                          {page.expiresAt && (
                            <p className="text-xs text-muted-foreground">
                              {isExpired ? "Expired" : "Expires"}: {format(new Date(page.expiresAt), "MMM dd, yyyy")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(pageUrl);
                              toast({
                                title: "Link copied!",
                                description: "Dynamic page URL copied to clipboard.",
                              });
                            }}
                            data-testid={`button-copy-link-${page.id}`}
                          >
                            <Copy className="w-3 h-3" />
                            Copy Link
                          </Button>
                          <Button 
                            variant="outline"
                            size="icon"
                            onClick={() => window.open(pageUrl, '_blank')}
                            data-testid={`button-view-page-${page.id}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
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
                    <Link href="/build">
                      <Button className="w-full mt-3" variant="outline" size="sm" data-testid={`button-customize-${product.id}`}>
                        Customize
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="my-qr-items" className="space-y-4">
            {claimedLoading ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </CardContent>
              </Card>
            ) : claimedInstances.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-12 text-center">
                  <Zap className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-semibold mb-2 text-foreground">No Activated Items Yet</h2>
                  <p className="text-muted-foreground mb-6">
                    When you receive a QR Gear product, scan its QR code and enter your activation code to start your 1-year hosting.
                  </p>
                  <Link href="/build">
                    <Button data-testid="button-get-qr-item">
                      Get a QR Item
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {claimedInstances.map((instance: any) => {
                  const expiresAt = new Date(instance.hostingExpiresAt);
                  const now = new Date();
                  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                  const isActive = instance.status === 'active' && expiresAt > now;

                  return (
                    <Card key={instance.id} className="glass-card" data-testid={`card-qr-item-${instance.id}`}>
                      <CardContent className="p-4 space-y-3">
                        {instance.previewImageUrl && (
                          <div className="aspect-video bg-muted rounded-md overflow-hidden">
                            <img src={instance.previewImageUrl} alt={instance.productName} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-foreground truncate">{instance.productName}</p>
                          {instance.qrgId && (
                            <p className="text-xs text-muted-foreground font-mono">{instance.qrgId}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          {isActive ? (
                            <Badge className="gap-1 text-xs">
                              <Shield className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{daysRemaining}d left</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => setLocation(`/my-item/${instance.id}`)}
                            data-testid={`button-view-item-${instance.id}`}
                          >
                            View Item
                          </Button>
                          {!isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/renew/${instance.id}`)}
                              data-testid={`button-renew-item-${instance.id}`}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
