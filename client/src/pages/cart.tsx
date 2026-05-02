import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart, Trash2, Plus, Minus, Loader2, ShoppingBag,
  ArrowRight, LogIn, Tag, ShieldCheck, Printer, QrCode,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import StorefrontLayout from "@/components/StorefrontLayout";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { useCart, mergeGuestCartOnLogin, type GuestCartItem } from "@/contexts/CartContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CartItem } from "@shared/schema";

export default function Cart() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { items: guestItems, removeItem, updateQuantity, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const [isMerging, setIsMerging] = useState(false);
  const mergeAttemptedRef = useRef(false);

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
      toast({ title: "Item removed", description: "The item has been removed from your cart" });
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      mergeAttemptedRef.current = false;
      return;
    }
    if (mergeAttemptedRef.current || guestItems.length === 0) return;

    mergeAttemptedRef.current = true;
    let cancelled = false;

    const runMerge = async () => {
      setIsMerging(true);
      try {
        const addToServer = async (item: Omit<GuestCartItem, "id" | "addedAt">) => {
          await apiRequest("POST", "/api/cart", item);
        };
        const result = await mergeGuestCartOnLogin(guestItems, addToServer);
        if (cancelled) return;
        if (result.merged > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
          clearCart();
          toast({
            title: "Cart merged",
            description: `${result.merged} item${result.merged > 1 ? "s" : ""} from your guest cart have been added`,
          });
        }
      } finally {
        if (!cancelled) setIsMerging(false);
      }
    };

    runMerge();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const isLoadingState = authLoading || (isAuthenticated && cartLoading) || isMerging;
  const displayItems = isAuthenticated && !isMerging ? serverCartItems : guestItems;
  const hasItems = displayItems.length > 0;

  const subtotal = displayItems.reduce((sum, item) => {
    const price = Number(item.price);
    return sum + (Number.isFinite(price) ? price : 0) * item.quantity;
  }, 0);
  const discountAmount = isMember ? subtotal * CREATOR_DISCOUNT : 0;
  const total = subtotal - discountAmount;

  const handleRemove = (id: string) => {
    if (isAuthenticated) {
      removeItemMutation.mutate(id);
    } else {
      removeItem(id);
      toast({ title: "Item removed", description: "The item has been removed from your cart" });
    }
  };

  const handleQuantityChange = (id: string, delta: number, currentQty: number) => {
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      handleRemove(id);
      return;
    }
    if (isAuthenticated) {
      updateQuantityMutation.mutate({ id, quantity: newQty });
    } else {
      updateQuantity(id, newQty);
    }
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in to complete your purchase" });
      setLocation("/login?redirect=/checkout");
      return;
    }
    setLocation("/checkout");
  };

  if (isLoadingState) {
    return (
      <StorefrontLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-muted-foreground text-sm">
              {isMerging ? "Syncing your cart…" : "Loading cart…"}
            </p>
          </div>
        </div>
      </StorefrontLayout>
    );
  }

  return (
    <StorefrontLayout>
      <SEO
        title="Your Cart | QR Gear"
        description="Review your custom QR code merchandise before checkout."
      />

      {!hasItems ? (
        <EmptyCart />
      ) : (
        <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 4rem)" }}>
          {/* Page header */}
          <div className="border-b bg-background px-4 py-4">
            <div className="container max-w-4xl mx-auto flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-primary flex-shrink-0" />
              <h1 className="text-2xl font-bold">Your Cart</h1>
              <span className="text-muted-foreground text-sm">
                ({displayItems.length} item{displayItems.length !== 1 ? "s" : ""})
              </span>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-4xl mx-auto px-4 py-5">
              <div className="lg:grid lg:grid-cols-3 lg:gap-8">

                {/* ── Item list ── */}
                <div className="lg:col-span-2 space-y-3 mb-6 lg:mb-0">
                  {displayItems.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onQuantityChange={handleQuantityChange}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>

                {/* ── Desktop order summary (hidden on mobile) ── */}
                <div className="hidden lg:block lg:col-span-1">
                  <div className="sticky top-4 space-y-4">
                    <OrderSummaryCard
                      subtotal={subtotal}
                      discountAmount={discountAmount}
                      total={total}
                      isMember={isMember}
                      discountLabel={discountLabel}
                      isAuthenticated={isAuthenticated}
                      onCheckout={handleCheckout}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Mobile sticky footer (hidden on desktop) ── */}
          <MobileCheckoutFooter
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            isMember={isMember}
            discountLabel={discountLabel}
            isAuthenticated={isAuthenticated}
            onCheckout={handleCheckout}
          />
        </div>
      )}
    </StorefrontLayout>
  );
}

/* ─────────────────────────────────────────
   Cart Item Card
───────────────────────────────────────── */
function CartItemCard({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem | GuestCartItem;
  onQuantityChange: (id: string, delta: number, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const customization = item.customization as Record<string, unknown>;
  const productName = (customization?.productName as string) || "Custom QR Product";
  const productImage = customization?.productImage as string;
  const qrType = customization?.qrType as string;
  const placement = customization?.placement as string;
  const color = customization?.productColor as string;
  const size = customization?.productSize as string;
  const unitPrice = Number(item.price);
  const safePrice = Number.isFinite(unitPrice) ? unitPrice : 0;
  const lineTotal = safePrice * item.quantity;

  return (
    <div
      className="flex gap-4 rounded-lg border bg-card p-4"
      data-testid={`card-cart-item-${item.id}`}
    >
      {/* Product image */}
      {productImage ? (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md bg-muted flex-shrink-0 overflow-hidden">
          <img
            src={productImage}
            alt={productName}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
          <ShoppingBag className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="font-semibold leading-snug" data-testid={`text-item-name-${item.id}`}>
            {productName}
          </h3>
          <p className="font-bold text-base flex-shrink-0" data-testid={`text-item-total-${item.id}`}>
            ${lineTotal.toFixed(2)}
          </p>
        </div>

        <div className="text-sm text-muted-foreground space-y-0.5">
          {qrType && <p>Type: {qrType}</p>}
          {size && <p>Size: {size}</p>}
          {color && <p>Color: {color}</p>}
          {placement && <p>Placement: {placement}</p>}
          {safePrice > 0 && item.quantity > 1 && (
            <p className="text-xs">${safePrice.toFixed(2)} each</p>
          )}
        </div>

        {/* Quantity + Remove */}
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              className="flex items-center justify-center w-10 h-10 text-muted-foreground hover-elevate active-elevate-2 transition-colors"
              onClick={() => onQuantityChange(item.id, -1, item.quantity)}
              aria-label="Decrease quantity"
              data-testid={`button-decrease-${item.id}`}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span
              className="w-10 h-10 flex items-center justify-center font-medium text-sm border-x"
              data-testid={`text-quantity-${item.id}`}
            >
              {item.quantity}
            </span>
            <button
              className="flex items-center justify-center w-10 h-10 text-muted-foreground hover-elevate active-elevate-2 transition-colors"
              onClick={() => onQuantityChange(item.id, 1, item.quantity)}
              aria-label="Increase quantity"
              data-testid={`button-increase-${item.id}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            className="flex items-center gap-1.5 text-sm text-destructive/80 hover:text-destructive transition-colors py-2"
            onClick={() => onRemove(item.id)}
            data-testid={`button-remove-${item.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Trust Badges (shared)
───────────────────────────────────────── */
function TrustBadges() {
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <QrCode className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
        <span>Includes your QR-linked design</span>
      </div>
      <div className="flex items-center gap-2">
        <Printer className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
        <span>Printed on demand</span>
      </div>
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
        <span>Secure checkout powered by Stripe</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Desktop Order Summary Card
───────────────────────────────────────── */
function OrderSummaryCard({
  subtotal, discountAmount, total, isMember, discountLabel, isAuthenticated, onCheckout,
}: {
  subtotal: number;
  discountAmount: number;
  total: number;
  isMember: boolean;
  discountLabel: string;
  isAuthenticated: boolean;
  onCheckout: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h2 className="font-semibold text-base">Order Summary</h2>

      {isMember && (
        <div
          className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-200 dark:border-emerald-800"
          data-testid="badge-member-discount"
        >
          <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {discountLabel} Creator Discount applied
          </span>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {isMember && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>Creator Discount ({discountLabel})</span>
            <span data-testid="text-member-savings">-${discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
          <span>Shipping</span>
          <span data-testid="text-shipping-free">FREE</span>
        </div>
      </div>

      <Separator />

      <div className="flex justify-between font-bold text-base">
        <span>Total</span>
        <span data-testid="text-cart-total">${total.toFixed(2)}</span>
      </div>

      {!isAuthenticated && (
        <div className="rounded-md bg-muted/60 p-3 text-center">
          <LogIn className="w-5 h-5 mx-auto mb-1.5 text-primary" />
          <p className="text-xs text-muted-foreground mb-2">Sign in to complete your purchase</p>
          <Link href="/account">
            <Button variant="outline" size="sm" className="w-full" data-testid="button-sign-in-cart">
              Sign In
            </Button>
          </Link>
        </div>
      )}

      <TrustBadges />

      <Separator />

      <Button
        className="w-full"
        size="lg"
        onClick={onCheckout}
        data-testid="button-checkout"
      >
        <ShieldCheck className="w-4 h-4 mr-2" />
        {isAuthenticated ? "Checkout Securely" : "Sign in to Checkout"}
      </Button>

      <Link href="/shop/internal/qrgear" className="block">
        <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
          Continue Shopping
        </Button>
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────
   Mobile Sticky Footer
───────────────────────────────────────── */
function MobileCheckoutFooter({
  subtotal, discountAmount, total, isMember, discountLabel, isAuthenticated, onCheckout,
}: {
  subtotal: number;
  discountAmount: number;
  total: number;
  isMember: boolean;
  discountLabel: string;
  isAuthenticated: boolean;
  onCheckout: () => void;
}) {
  return (
    <div
      className="lg:hidden sticky bottom-0 z-10 bg-background border-t px-4 pt-4 space-y-3"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
    >
      <TrustBadges />

      <Separator />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {isMember && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>Creator Discount ({discountLabel})</span>
            <span>-${discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-xs">
          <span>Shipping</span>
          <span>FREE</span>
        </div>
        <div className="flex justify-between font-bold text-base pt-0.5">
          <span>Total</span>
          <span data-testid="text-cart-total-mobile">${total.toFixed(2)}</span>
        </div>
      </div>

      {!isAuthenticated && (
        <Link href="/account">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-sign-in-mobile">
            <LogIn className="w-4 h-4 mr-2" />
            Sign in to Checkout
          </Button>
        </Link>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={onCheckout}
        style={{ minHeight: "3rem" }}
        data-testid="button-checkout-mobile"
      >
        <ShieldCheck className="w-4 h-4 mr-2" />
        {isAuthenticated ? "Checkout Securely" : "Sign in to Checkout"}
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────
   Empty Cart
───────────────────────────────────────── */
function EmptyCart() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-sm mx-auto space-y-5">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
          <ShoppingBag className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold" data-testid="text-empty-cart">Your cart is empty</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Start with a product and your design will appear here.
          </p>
        </div>
        <Link href="/shop/internal/qrgear">
          <Button size="lg" className="w-full sm:w-auto" data-testid="button-browse-products">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Browse Products
          </Button>
        </Link>
      </div>
    </div>
  );
}
