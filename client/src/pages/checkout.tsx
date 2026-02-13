import { useCallback, useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ShoppingCart, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { CartItem } from "@shared/schema";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

export default function Checkout() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { data: cartItems = [], isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login?redirect=/checkout");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const fetchClientSecret = useCallback(async () => {
    if (!cartItems.length) {
      throw new Error("No items in cart");
    }

    const origin = window.location.origin;
    const returnUrl = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

    const response = await apiRequest("POST", "/api/checkout/embedded", {
      returnUrl,
    });

    const data = await response.json();
    
    if (data.error) {
      setCheckoutError(data.error);
      throw new Error(data.error);
    }

    return data.clientSecret;
  }, [cartItems]);

  if (authLoading || cartLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
<div className="container mx-auto px-4 py-16 max-w-2xl">
          <Card className="text-center py-12">
            <CardContent>
              <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-6">
                Add items to your cart before checking out
              </p>
              <Link href="/build">
                <Button data-testid="button-start-shopping">Start Shopping</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const total = cartItems.reduce((sum, item) => {
    return sum + parseFloat(item.price) * item.quantity;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Checkout | QR Gear"
        description="Complete your purchase of custom QR code merchandise."
      />
      <Navbar />
<div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/cart">
            <Button variant="ghost" size="icon" data-testid="button-back-to-cart">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Secure Checkout</h1>
            <p className="text-muted-foreground">
              {cartItems.length} item{cartItems.length > 1 ? "s" : ""} - ${total.toFixed(2)}
            </p>
          </div>
        </div>

        {checkoutError && (
          <Card className="mb-6 border-destructive">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Checkout Error</p>
                <p className="text-sm text-muted-foreground">{checkoutError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="checkout" className="min-h-[400px]">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Your payment is securely processed by Stripe. QR Gear never sees your card details.
        </p>
      </div>
    </div>
  );
}
