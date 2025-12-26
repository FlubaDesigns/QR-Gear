import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Users,
  Search,
  Mail,
  ShoppingBag,
  Calendar,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import type { User, OrderUnified } from "@shared/schema";
import { getDisplayName, getInitials } from "@/lib/admin-utils";

interface CustomerWithStats {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: Date | null;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
}

interface CustomerDetail {
  customer: CustomerWithStats;
  recentOrders: OrderUnified[];
}

function CustomerCard({
  customer,
  onClick,
}: {
  customer: CustomerWithStats;
  onClick: () => void;
}) {
  return (
    <Card className="hover-elevate cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={customer.profileImageUrl || undefined} />
            <AvatarFallback>{getInitials(customer)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate" data-testid={`text-customer-name-${customer.id}`}>
                {getDisplayName(customer)}
              </h3>
            </div>
            {customer.email && (
              <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ShoppingBag className="w-3 h-3" />
                <span>{customer.orderCount} orders</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="w-3 h-3" />
                <span>${customer.totalSpent.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="flex-shrink-0 min-h-12 min-w-12" data-testid={`button-view-customer-${customer.id}`}>
            <ExternalLink className="w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerDetailModal({
  customerId,
  open,
  onClose,
}: {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<CustomerDetail>({
    queryKey: ["/api/admin/customers", customerId],
    enabled: !!customerId && open,
  });

  const customer = data?.customer;
  const orders = data?.recentOrders || [];

  const initials = customer ? getInitials(customer) : "??";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : customer ? (
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-1">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={customer.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {getDisplayName(customer)}
                  </h3>
                  {customer.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-sm text-primary flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      {customer.email}
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{customer.orderCount}</p>
                    <p className="text-xs text-muted-foreground">Orders</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">${customer.totalSpent.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">
                      {customer.createdAt
                        ? new Date(customer.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            year: "2-digit",
                          })
                        : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">Joined</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Recent Orders
                </h4>
                {orders.length > 0 ? (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 bg-muted/50 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            Order #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString()
                              : "-"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${order.total}</p>
                          <Badge
                            variant="outline"
                            className={
                              order.status === "delivered"
                                ? "bg-green-500/10 text-green-600"
                                : order.status === "shipped"
                                ? "bg-blue-500/10 text-blue-600"
                                : "bg-yellow-500/10 text-yellow-600"
                            }
                          >
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No orders yet
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            Customer not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCustomers() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery<CustomerWithStats[]>({
    queryKey: ["/api/admin/customers"],
  });

  const filteredCustomers = customers?.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const displayName = getDisplayName(c).toLowerCase();
    return (
      displayName.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
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
                <Users className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    Customers
                  </h1>
                  <p className="text-xs text-slate-400">
                    {customers?.length || 0} total customers
                  </p>
                </div>
              </div>
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
            Customers
          </span>
        </nav>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12"
              data-testid="input-search-customers"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCustomers && filteredCustomers.length > 0 ? (
          <div className="space-y-3">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onClick={() => setSelectedCustomerId(customer.id)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {search ? "No customers found" : "No customers yet"}
              </h3>
              <p className="text-muted-foreground">
                {search
                  ? "Try a different search term"
                  : "Customers will appear here when they create accounts"}
              </p>
            </CardContent>
          </Card>
        )}

        <CustomerDetailModal
          customerId={selectedCustomerId}
          open={!!selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      </main>
    </div>
  );
}
