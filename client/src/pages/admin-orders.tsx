import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Search, 
  RefreshCw,
  ExternalLink,
  ShoppingBag,
  Filter
} from "lucide-react";
import type { OrderUnified } from "@shared/schema";
import type { AdminTab } from "@/components/admin/AdminSectionTabs";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { SELL_SUBNAV } from "@/components/admin/adminNavConfig";
import { Users, DollarSign, Tag, Gift } from "lucide-react";

type OrderStatus = "pending" | "routed" | "in_production" | "shipped" | "delivered" | "cancelled";

interface OrderItem {
  masterProductId: string;
  variantSku: string;
  quantity: number;
  price: number;
  productTitle?: string;
}

interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

interface StatusHistory {
  status: string;
  timestamp: string;
  note?: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  routed: { label: "Routed", icon: Package, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  in_production: { label: "In Production", icon: Package, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  shipped: { label: "Shipped", icon: Truck, color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  delivered: { label: "Delivered", icon: CheckCircle, color: "bg-green-500/10 text-green-500 border-green-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
  direct: { label: "Direct", color: "bg-gray-500/10 text-gray-500" },
  etsy: { label: "Etsy", color: "bg-orange-500/10 text-orange-500" },
  ebay: { label: "eBay", color: "bg-yellow-500/10 text-yellow-700" },
  amazon: { label: "Amazon", color: "bg-amber-500/10 text-amber-600" },
};

const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  printify: { label: "Printify", color: "bg-green-500/10 text-green-600" },
  printful: { label: "Printful", color: "bg-blue-500/10 text-blue-600" },
  apliiq: { label: "Apliiq", color: "bg-purple-500/10 text-purple-600" },
};

const orderTabs: AdminTab[] = [
  { id: "all", label: "All", icon: ShoppingBag },
  { id: "pending", label: "Pending", icon: Clock },
  { id: "production", label: "Production", icon: Package },
  { id: "shipped", label: "Shipped", icon: Truck },
];

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const config = CHANNEL_CONFIG[channel] || { label: channel, color: "bg-muted" };
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  );
}

function ProviderBadge({ provider }: { provider: string | null }) {
  if (!provider) return <span className="text-muted-foreground text-sm">Not routed</span>;
  const config = PROVIDER_CONFIG[provider] || { label: provider, color: "bg-muted" };
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  );
}

function OrderCard({ order, onViewDetails }: { order: OrderUnified; onViewDetails: () => void }) {
  const items = order.items as OrderItem[] || [];
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const profit = order.profit ? parseFloat(order.profit) : null;

  return (
    <Card 
      className="hover-elevate cursor-pointer transition-all"
      onClick={onViewDetails}
      data-testid={`card-order-${order.id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-sm" data-testid={`text-order-id-${order.id}`}>
              #{order.externalOrderId || order.id.substring(0, 8)}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString()}
            </span>
          </div>
          <StatusBadge status={order.status as OrderStatus} />
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <ChannelBadge channel={order.sourceChannel} />
          <ProviderBadge provider={order.routedProvider} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <ShoppingBag className="w-4 h-4" />
            <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold" data-testid={`text-order-total-${order.id}`}>
              ${parseFloat(order.total).toFixed(2)}
            </span>
            {profit !== null && (
              <span className={`text-xs ${profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {order.trackingNumber && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground truncate">{order.trackingNumber}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderDetailsDialog({ order, open, onOpenChange }: { 
  order: OrderUnified | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/orders-unified/${orderId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders-unified"] });
      toast({ title: "Order status updated" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to update status", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  if (!order) return null;

  const items = order.items as OrderItem[] || [];
  const shippingAddress = order.shippingAddress as ShippingAddress | null;
  const statusHistory = order.statusHistory as StatusHistory[] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span>Order #{order.externalOrderId || order.id.substring(0, 8)}</span>
            <StatusBadge status={order.status as OrderStatus} />
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              <ChannelBadge channel={order.sourceChannel} />
              <ProviderBadge provider={order.routedProvider} />
              {order.providerOrderId && (
                <Badge variant="outline" className="gap-1">
                  Provider: {order.providerOrderId}
                </Badge>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="font-medium text-sm mb-2">Customer</h4>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.customerName || "Guest"}</p>
                <p className="text-muted-foreground">{order.customerEmail || "No email"}</p>
              </div>
            </div>

            {shippingAddress && (
              <div>
                <h4 className="font-medium text-sm mb-2">Shipping Address</h4>
                <div className="text-sm text-muted-foreground">
                  <p>{shippingAddress.name}</p>
                  <p>{shippingAddress.address1}</p>
                  {shippingAddress.address2 && <p>{shippingAddress.address2}</p>}
                  <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}</p>
                  <p>{shippingAddress.country}</p>
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h4 className="font-medium text-sm mb-2">Items</h4>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm p-3 rounded-lg bg-muted/50">
                    <div className="min-w-0 mr-2">
                      <span className="font-medium truncate block">{item.productTitle || item.masterProductId}</span>
                      <span className="text-muted-foreground text-xs">{item.variantSku}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span>x{item.quantity}</span>
                      <span className="ml-2 font-medium">${item.price.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium text-sm mb-2">Order Total</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${parseFloat(order.subtotal).toFixed(2)}</span>
                </div>
                {order.shippingTotal && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>${parseFloat(order.shippingTotal).toFixed(2)}</span>
                  </div>
                )}
                {order.taxTotal && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>${parseFloat(order.taxTotal).toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>${parseFloat(order.total).toFixed(2)}</span>
                </div>
                {order.productionCost && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Production Cost</span>
                    <span>-${parseFloat(order.productionCost).toFixed(2)}</span>
                  </div>
                )}
                {order.profit && (
                  <div className={`flex justify-between font-medium ${parseFloat(order.profit) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    <span>Profit</span>
                    <span>${parseFloat(order.profit).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {order.trackingNumber && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-2">Tracking</h4>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    <span className="font-mono text-sm">{order.trackingNumber}</span>
                    {order.trackingUrl && (
                      <a 
                        href={order.trackingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}

            {statusHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-2">Status History</h4>
                  <div className="space-y-2">
                    {statusHistory.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium">{entry.status}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                          {entry.note && <p className="text-muted-foreground text-xs">{entry.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h4 className="font-medium text-sm mb-2">Actions</h4>
              <Select
                onValueChange={(status) => {
                  updateStatusMutation.mutate({ orderId: order.id, status });
                }}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="min-h-[48px] w-full" data-testid="select-status">
                  <SelectValue placeholder="Update Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="routed">Routed</SelectItem>
                  <SelectItem value="in_production">In Production</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function OrderList({ orders, onViewDetails }: { orders: OrderUnified[]; onViewDetails: (order: OrderUnified) => void }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8">
        <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No orders found</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((order) => (
        <OrderCard 
          key={order.id} 
          order={order} 
          onViewDetails={() => onViewDetails(order)}
        />
      ))}
    </div>
  );
}

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderUnified | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: orders = [], isLoading, refetch } = useQuery<OrderUnified[]>({
    queryKey: ["/api/admin/orders-unified"],
  });

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (channelFilter !== "all" && order.sourceChannel !== channelFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesId = order.id.toLowerCase().includes(query) || 
                       order.externalOrderId?.toLowerCase().includes(query);
      const matchesCustomer = order.customerName?.toLowerCase().includes(query) ||
                             order.customerEmail?.toLowerCase().includes(query);
      const matchesTracking = order.trackingNumber?.toLowerCase().includes(query);
      if (!matchesId && !matchesCustomer && !matchesTracking) return false;
    }
    return true;
  });

  const ordersByTab: Record<string, OrderUnified[]> = {
    all: filteredOrders,
    pending: filteredOrders.filter(o => o.status === "pending"),
    production: filteredOrders.filter(o => o.status === "routed" || o.status === "in_production"),
    shipped: filteredOrders.filter(o => o.status === "shipped"),
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    inProduction: orders.filter(o => o.status === "routed" || o.status === "in_production").length,
    shipped: orders.filter(o => o.status === "shipped").length,
    revenue: orders.reduce((acc, o) => acc + parseFloat(o.total), 0),
    profit: orders.reduce((acc, o) => acc + (o.profit ? parseFloat(o.profit) : 0), 0),
  };

  const handleViewDetails = (order: OrderUnified) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  return (
    <>
      <AdminShell
        title="Orders"
        subtitle={`${stats.total} total`}
        icon={Truck}
        backHref="/admin"
        tabs={orderTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sectionNav={<AdminSectionSubNav items={SELL_SUBNAV} />}
        actions={
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
            className="qr-touch-48"
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""} sm:mr-2`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      >
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold" data-testid="text-stat-total">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-yellow-500">{stats.pending}</div>
              <div className="text-[10px] text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-purple-500">{stats.inProduction}</div>
              <div className="text-[10px] text-muted-foreground">Production</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-cyan-500">{stats.shipped}</div>
              <div className="text-[10px] text-muted-foreground">Shipped</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-green-500">${stats.revenue.toFixed(0)}</div>
              <div className="text-[10px] text-muted-foreground">Revenue</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className={`text-xl font-bold ${stats.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                ${stats.profit.toFixed(0)}
              </div>
              <div className="text-[10px] text-muted-foreground">Profit</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[48px] pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="min-h-[48px] w-[140px]" data-testid="select-status-filter">
              <Filter className="w-4 h-4 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="routed">Routed</SelectItem>
              <SelectItem value="in_production">In Production</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="min-h-[48px] w-[140px]" data-testid="select-channel-filter">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="etsy">Etsy</SelectItem>
              <SelectItem value="ebay">eBay</SelectItem>
              <SelectItem value="amazon">Amazon</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <OrderList 
          orders={ordersByTab[activeTab] || []} 
          onViewDetails={handleViewDetails} 
        />

        <OrderDetailsDialog 
          order={selectedOrder}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      </AdminShell>
    </>
  );
}
