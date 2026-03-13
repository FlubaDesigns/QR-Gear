import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, Plus, Minus, Loader2, ShoppingBag, ArrowRight, LogIn, Tag } from "lucide-react";
import { Link, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart, mergeGuestCartOnLogin, type GuestCartItem } from "@/hooks/useGuestCart";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CartItem } from "@shared/schema";

export default function Cart() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { guestItems, removeItem: removeGuestItem, updateQuantity: updateGuestQuantity, clearCart: clearGuestCart } = useGuestCart();
  const [, setLocation] = useLocation();

  const { data: serverCartItems = [], isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
  });

  const { data: memberStatus } = useQuery<{ isMember: boolean }>({
    queryKey: ["/api/members/check-status"],
    enabled: isAuthenticated,
  });

  const { data: pricingSettings } = useQuery<{ memberProfitShare?: number }>({
    queryKey: ["/api/pricing-settings"],
    enabled: isAuthenticated,
  });

  const isMember = memberStatus?.isMember === true;
  const CREATOR_DISCOUNT = pricingSettings?.memberProfitShare ?? 0.25;
  const discountLabel = `${Math.round(CREATOR_DISCOUNT * 100)}%`;

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      await apiRequest("PUT", `/api/cart/${id}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cart/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Item removed",
        description: "The item has been removed from your cart",
      });
    },
  });

  useEffect(() => {
    const handleMerge = async () => {
      if (isAuthenticated && guestItems.length > 0) {
        const addToServer = async (item: Omit<GuestCartItem, "id" | "addedAt">) => {
          await apiRequest("POST", "/api/cart", item);
        };
        const result = await mergeGuestCartOnLogin(guestItems, addToServer);
        if (result.merged > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
          toast({
            title: "Cart merged",
            description: `${result.merged} item(s) from your guest cart have been added`,
          });
          clearGuestCart();
        }
      }
    };
    handleMerge();
  }, [isAuthenticated, guestItems.length]);

  
  const isLoading = authLoading || (isAuthenticated && cartLoading);

  const displayItems = isAuthenticated ? serverCartItems : guestItems;
  const hasItems = displayItems.length > 0;

  const total = displayItems.reduce((sum, item) => {
    const price = parseFloat(item.price);
    const qty = item.quantity;
    return sum + price * qty;
  }, 0);

  const handleRemove = (id: string) => {
    if (isAuthenticated) {
      removeItemMutation.mutate(id);
    } else {
      removeGuestItem(id);
      toast({
        title: "Item removed",
        description: "The item has been removed from your cart",
      });
    }
  };

  const handleQuantityChange = (id: string, delta: number, currentQty: number) => {
    const newQty = Math.max(1, currentQty + delta);
    if (isAuthenticated) {
      updateQuantityMutation.mutate({ id, quantity: newQty });
    } else {
      updateGuestQuantity(id, newQty);
    }
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to complete your purchase",
      });
      setLocation("/login?redirect=/checkout");
      return;
    }
    setLocation("/checkout");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
<div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading cart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Your Cart | QR Gear"
        description="Review your custom QR code merchandise before checkout."
      />
      <Navbar />
<div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <ShoppingCart className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Your Cart</h1>
          {hasItems && (
            <span className="text-muted-foreground">({displayItems.length} item{displayItems.length > 1 ? "s" : ""})</span>
          )}
        </div>

        {!hasItems ? (
          <Card className="text-center py-12">
            <CardContent>
              <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-6">
                Start creating custom QR products to add them here
              </p>
              <Link href="/build">
                <Button data-testid="button-start-creating">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Creating
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {displayItems.map((item) => {
                const customization = item.customization as Record<string, unknown>;
                const productName = (customization?.productName as string) || "Custom QR Product";
                const productImage = customization?.productImage as string;
                const qrType = customization?.qrType as string;
                const placement = customization?.placement as string;
                const color = customization?.productColor as string;
                const size = customization?.productSize as string;
                
                return (
                  <Card key={item.id} data-testid={`card-cart-item-${item.id}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {productImage && (
                          <div className="w-20 h-20 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                            <img 
                              src={productImage} 
                              alt={productName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{productName}</h3>
                          <div className="text-sm text-muted-foreground space-y-1 mt-1">
                            <p>Type: {qrType || "Text QR"}</p>
                            {size && <p>Size: {size}</p>}
                            {color && <p>Color: {color}</p>}
                            {placement && <p>Placement: {placement}</p>}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <p className="font-bold text-lg">${parseFloat(item.price).toFixed(2)}</p>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleQuantityChange(item.id, -1, item.quantity)}
                              disabled={item.quantity <= 1}
                              data-testid={`button-decrease-${item.id}`}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center" data-testid={`text-quantity-${item.id}`}>
                              {item.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleQuantityChange(item.id, 1, item.quantity)}
                              data-testid={`button-increase-${item.id}`}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemove(item.id)}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isMember && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800" data-testid="badge-member-discount">
                      <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{discountLabel} Creator Discount applied</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  {isMember && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Creator Discount ({discountLabel})</span>
                      <span data-testid="text-member-savings">-${(total * CREATOR_DISCOUNT).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                    <span>Shipping</span>
                    <span data-testid="text-shipping-free">FREE</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span data-testid="text-cart-total">${isMember ? (total * (1 - CREATOR_DISCOUNT)).toFixed(2) : total.toFixed(2)}</span>
                  </div>
                  
                  {!isAuthenticated && (
                    <Card className="bg-muted/50">
                      <CardContent className="p-4 text-center">
                        <LogIn className="w-6 h-6 mx-auto mb-2 text-primary" />
                        <p className="text-sm text-muted-foreground mb-3">
                          Sign in to complete your purchase
                        </p>
                        <Link href="/account">
                          <Button variant="outline" size="sm" className="w-full" data-testid="button-sign-in-cart">
                            Sign In
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  )}

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleCheckout}
                    disabled={!isAuthenticated}
                    data-testid="button-checkout"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    {isAuthenticated ? "Proceed to Checkout" : "Sign in to Checkout"}
                  </Button>

                  <Link href="/build" className="block">
                    <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
                      Continue Shopping
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
