import { privateQueryKey } from '@/lib/identityCache';
import { useCallback, useState, useEffect, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ShoppingCart, AlertCircle } from "lucide-react";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { CartItem } from "@shared/schema";
import { ProductProofApproval, ProductProofImages } from '@/features/shared/components/ProductProofApproval';


export default function Checkout() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [bundleId, setBundleId] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<Record<string, string>>({});
  const [paymentReview, setPaymentReview] = useState<{ quoteToken: string; proofApprovals: Record<string, { approved: true; proofId: string }>; bundle?: { bundleId: string; selectedItems?: string[] } } | null>(null);

  const paymentConfig = useQuery<{ publishableKey: string }>({
    queryKey: ["/api/stripe/publishable-key"],
    queryFn: async () => (await apiRequest("GET", "/api/stripe/publishable-key")).json(),
    enabled: isAuthenticated && !!paymentReview,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const stripePromise = useMemo(() => paymentConfig.data ? loadStripe(paymentConfig.data.publishableKey) : null, [paymentConfig.data?.publishableKey]);

  const { data: cartItems = [], isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: privateQueryKey("/api/cart", user?.id),
    enabled: !!user?.id,
  });

  type Quote = { quoteToken: string; amount: number; subtotalCents: number; proofs: Array<{cartItemId: string; title: string; proofId: string; selectedColor: string; selectedSize: string; mockupUrl: string; mockupUrls?: Record<string,string>; warnings: string[]}>;
    bundle: null | { name: string; discountCents: number };
    offers: Array<{ id: string; name: string; bundleType: string; minItems: number; maxItems: number; items: Array<{ id: string; name: string; quantity: number }> }> };
  const quoteRequest = async (bundle?: { bundleId: string; selectedItems?: string[] }): Promise<Quote> => {
    const response = await apiRequest("POST", "/api/checkout/quote", { bundle });
    return response.json();
  };
  const baseQuote = useQuery<Quote>({ queryKey: ["/api/checkout/quote", cartItems], queryFn: () => quoteRequest(),
    enabled: isAuthenticated && cartItems.length > 0 && !paymentReview, retry: false });
  const offer = baseQuote.data?.offers.find(item => item.id === bundleId);
  const selectionValid = !!offer && (offer.bundleType === "fixed" || (selectedItems.length >= offer.minItems && selectedItems.length <= offer.maxItems));
  const bundle = bundleId ? { bundleId, ...(offer?.bundleType === "pick" ? { selectedItems } : {}) } : undefined;
  const selectedQuote = useQuery<Quote>({ queryKey: ["/api/checkout/quote", cartItems, bundle], queryFn: () => quoteRequest(bundle),
    enabled: isAuthenticated && !!bundleId && selectionValid && !paymentReview, retry: false });
  const currentQuote = bundleId ? selectedQuote : baseQuote;
  const quote = currentQuote.data;
  const ready = !!quote && !currentQuote.isFetching && !currentQuote.error && (!bundleId || selectionValid);
  const approved = !!quote?.proofs?.length && quote.proofs.every(proof => approvals[proof.cartItemId] === proof.proofId);
  useEffect(() => { setApprovals({}); }, [quote?.quoteToken]);

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

    if (!paymentReview) throw new Error("Review your order total before payment.");
    try {
      const response = await apiRequest("POST", "/api/checkout/embedded", { returnUrl, ...paymentReview });
      const data = await response.json();
      if (!data.clientSecret) throw new Error(data.error || "Checkout did not return a payment session.");
      return data.clientSecret;
    } catch (e: any) {
      setCheckoutError(e.message);
      throw e;
    }
  }, [cartItems, paymentReview]);

  if (authLoading || cartLoading) {
    return (
      <div className="bg-background">

        <div className="row py-16 text-center">
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
      <div className="bg-background">

<div className="row py-16">
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


  return (
    <div className="bg-background">
      <SEO
        title="Checkout | QR Gear"
        description="Complete your purchase of custom QR code merchandise."
      />

<div className="row py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/cart">
            <Button variant="ghost" size="icon" data-testid="button-back-to-cart">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Secure Checkout</h1>
            <p className="text-muted-foreground">
              {cartItems.length} item{cartItems.length > 1 ? "s" : ""}{quote ? ` — $${(quote.amount / 100).toFixed(2)}` : ""}
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

        <Card className="mb-6">
          <CardHeader><CardTitle>Review your order</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {baseQuote.error ? <p role="alert">{baseQuote.error.message} <Button onClick={() => baseQuote.refetch()}>Retry</Button></p> : null}
            {!!baseQuote.data?.offers.length && <div className="space-y-3">
              <label className="block font-medium" htmlFor="checkout-bundle">Bundle offer</label>
              <select id="checkout-bundle" className="w-full min-h-12 rounded-md border bg-background px-3" value={bundleId} disabled={!!paymentReview}
                onChange={e => { setBundleId(e.target.value); setSelectedItems([]); setCheckoutError(null); }}>
                <option value="">No bundle</option>
                {baseQuote.data.offers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {offer?.bundleType === "pick" && <fieldset disabled={!!paymentReview} className="space-y-2">
                <legend>Choose {offer.minItems === offer.maxItems ? offer.minItems : `${offer.minItems}–${offer.maxItems}`} products</legend>
                {offer.items.map(item => <label key={item.id} className="flex min-h-12 items-center gap-3 rounded-md border p-3">
                  <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={e => setSelectedItems(previous => e.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} />
                  {item.name} × {item.quantity}
                </label>)}
              </fieldset>}
              {offer?.bundleType === "fixed" && <ul>{offer.items.map(item => <li key={item.id}>{item.name} × {item.quantity}</li>)}</ul>}
              <p className="text-sm text-muted-foreground">One bundle per order. Savings apply to the listed quantities at their base prices. Size surcharges and extra quantities are added separately.</p>
            </div>}
            {bundleId && !selectionValid && <p role="alert">Choose the required number of products for this bundle.</p>}
            {currentQuote.error && <p role="alert">{currentQuote.error.message} <Button onClick={() => currentQuote.refetch()}>Refresh total</Button></p>}
            {currentQuote.isFetching && <p>Calculating your total…</p>}
            {ready && quote && <div className="space-y-2" aria-live="polite">
              <p className="flex justify-between"><span>Subtotal</span><span>${(quote.subtotalCents / 100).toFixed(2)}</span></p>
              {quote.bundle && <p className="flex justify-between"><span>{quote.bundle.name}</span><span>{quote.bundle.discountCents >= 0 ? "−" : "+"}${(Math.abs(quote.bundle.discountCents) / 100).toFixed(2)}</span></p>}
              <p className="flex justify-between font-bold"><span>Total</span><span data-testid="checkout-quoted-total">${(quote.amount / 100).toFixed(2)}</span></p>
            </div>}
            {!paymentReview && ready && quote?.proofs?.map(proof => <div key={proof.cartItemId} className="space-y-3 rounded-md border p-3">
              <h3 className="font-semibold">{proof.title}</h3>
              <ProductProofImages proof={proof} />
              <p>{proof.selectedColor} · {proof.selectedSize}</p>
              <ProductProofApproval checked={approvals[proof.cartItemId] === proof.proofId} warnings={proof.warnings}
                onChange={checked => setApprovals(previous => ({ ...previous, [proof.cartItemId]: checked ? proof.proofId : '' }))} />
            </div>)}
            {!paymentReview ? <Button className="w-full min-h-12" disabled={!ready || !approved || !quote || quote.amount <= 0}
              onClick={() => { if (quote && approved) { setCheckoutError(null); setPaymentReview({ quoteToken: quote.quoteToken, bundle,
                proofApprovals: Object.fromEntries(quote.proofs.map(proof => [proof.cartItemId, { approved: true as const, proofId: proof.proofId }])) }); } }}>Continue to payment</Button>
              : <Button variant="outline" className="min-h-12" onClick={() => { setPaymentReview(null); setApprovals({}); setCheckoutError(null); void currentQuote.refetch(); }}>Change order selection</Button>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div id="checkout" className="min-h-[400px]">
              {paymentReview && paymentConfig.isError ? <p role="alert">Live payments are temporarily unavailable. Please try again later or contact QR Gear.</p>
                : paymentReview && !paymentConfig.isFetching && stripePromise ? <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider> : <p className="text-muted-foreground">{paymentReview ? "Loading secure payment…" : "Review your total above to continue."}</p>}
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
