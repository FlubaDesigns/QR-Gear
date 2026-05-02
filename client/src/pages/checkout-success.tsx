import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Package, ArrowRight, Mail, Loader2 } from "lucide-react";
import { Link } from "wouter";
import SEO from "@/components/SEO";
import type { Order, OrderItem } from "@shared/schema";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export default function CheckoutSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get("session_id"));
  }, []);

  const { data: orderData, isLoading, error } = useQuery<{ order: OrderWithItems; message: string }>({
    queryKey: ["/api/checkout/verify", sessionId],
    enabled: !!sessionId,
  });

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background">
<div className="container mx-auto px-4 py-16 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Invalid checkout session. Please try again.</p>
              <Link href="/shop/internal/qrgear">
                <Button className="mt-4" data-testid="button-back-to-store">
                  Back to Store
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
<div className="container mx-auto px-4 py-16 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Confirming your order...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !orderData?.order) {
    return (
      <div className="min-h-screen bg-background">
<div className="container mx-auto px-4 py-16 text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                There was an issue confirming your order. If you were charged, please contact support.
              </p>
              <Link href="/account">
                <Button className="mt-4" data-testid="button-view-orders">
                  View My Orders
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const order = orderData.order;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Order Confirmed | QR Gear"
        description="Your QR Gear order has been confirmed and is being processed."
      />
<div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-order-confirmed">
            Order Confirmed!
          </h1>
          <p className="text-muted-foreground">
            Thank you for your purchase. Your order has been received and is being processed.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Details
            </CardTitle>
            <Badge variant="secondary" data-testid="badge-order-status">
              {order.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="font-mono font-medium" data-testid="text-order-id">
                  {order.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Date</p>
                <p className="font-medium" data-testid="text-order-date">
                  {new Date(order.createdAt!).toLocaleDateString()}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <p className="font-medium">Items Ordered</p>
              {order.items?.map((item, index) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center py-2 border-b last:border-0"
                  data-testid={`order-item-${index}`}
                >
                  <div>
                    <p className="font-medium">Product #{item.productId.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium">${Number(item.price).toFixed(2)}</p>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total</span>
              <span data-testid="text-order-total">${Number(order.totalAmount).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium mb-1">What happens next?</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>1. Your order is being sent to our production partner</li>
                  <li>2. Your custom QR products will be printed and quality checked</li>
                  <li>3. You will receive shipping updates via email</li>
                  <li>4. Typical delivery time is 5-7 business days</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/account">
            <Button variant="outline" className="w-full sm:w-auto" data-testid="button-view-orders">
              View My Orders
            </Button>
          </Link>
          <Link href="/build">
            <Button className="w-full sm:w-auto" data-testid="button-create-more">
              Create More Products
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
