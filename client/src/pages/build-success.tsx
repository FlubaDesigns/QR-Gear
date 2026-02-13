import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Package, Crown, Users, ArrowRight, Loader2, QrCode, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import SEO from "@/components/SEO";
import { apiRequest } from "@/lib/queryClient";

interface PublicOrder {
  id: string;
  claimCode: string;
  productTitle: string;
  qrType: string;
  selectedColor: string;
  selectedSize: string;
  totalAmount: number;
  mockupUrl?: string | null;
  lifestyleMockupUrl?: string | null;
  buyerEmail: string;
  buyerName: string;
  status: string;
  createdAt: string;
}

type PostSalePath = null | 'member' | 'guest';

export default function BuildSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [claimCode, setClaimCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyProcessed, setAlreadyProcessed] = useState(false);
  const [chosenPath, setChosenPath] = useState<PostSalePath>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    setSessionId(sid);
    if (sid) {
      verifyPayment(sid);
    } else {
      setIsLoading(false);
      setError("No checkout session found. If you were charged, please contact support.");
    }
  }, []);

  async function verifyPayment(sid: string) {
    try {
      const resp = await fetch(`/api/public/checkout/verify/${sid}`);
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Verification failed");
        setIsLoading(false);
        return;
      }
      setOrder(data.order);
      setClaimCode(data.claimCode || data.order?.claimCode || "");
      setAlreadyProcessed(!!data.alreadyProcessed);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || "Something went wrong verifying your payment.");
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <SEO title="Confirming Order | QR Gear" description="Confirming your QR Gear purchase." />
        <Card className="max-w-md w-full mx-4 bg-slate-800/80 border-slate-700">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
            <p className="text-slate-300 text-lg font-medium">Confirming your order...</p>
            <p className="text-slate-500 text-sm">This will only take a moment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <SEO title="Order Issue | QR Gear" description="There was an issue with your order." />
        <Card className="max-w-md w-full mx-4 bg-slate-800/80 border-slate-700">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <p className="text-red-400 font-medium">{error}</p>
            <Link href="/build">
              <Button className="bg-blue-500" data-testid="button-back-to-build">
                Try Again
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) return null;

  if (chosenPath === 'member') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 py-8 px-4">
        <SEO title="Become a Member | QR Gear" description="Join QR Gear to earn from your designs." />
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-4">
              <Crown className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-become-member">
              Welcome to the QR Gear Family
            </h1>
            <p className="text-slate-400">Create your free account to unlock these perks</p>
          </div>

          <Card className="bg-slate-800/80 border-slate-700">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white font-medium">Track Your Shipment</p>
                  <p className="text-slate-400 text-sm">Get real-time updates on your order status and delivery</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white font-medium">Keep Your Custom Graphic Forever</p>
                  <p className="text-slate-400 text-sm">Without an account, your design is retained for 30 days</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white font-medium">Turn This Into Income</p>
                  <p className="text-slate-400 text-sm">Sell your design to others and earn a share of every sale</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <QrCode className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white font-medium">Manage Your QR Destination</p>
                  <p className="text-slate-400 text-sm">Update where your QR code points anytime, even after printing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Link href="/members">
              <Button className="w-full bg-amber-500 text-black font-bold" data-testid="button-create-account">
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full text-slate-500"
              onClick={() => setChosenPath('guest')}
              data-testid="button-skip-member"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (chosenPath === 'guest') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 py-8 px-4">
        <SEO title="Order Confirmed | QR Gear" description="Your QR Gear order has been confirmed." />
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-guest-confirmed">
              You're All Set!
            </h1>
            <p className="text-slate-400">Your custom QR product is on its way.</p>
          </div>

          <Card className="bg-slate-800/80 border-slate-700">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <span className="text-slate-400 text-sm">Order</span>
                <span className="text-white font-mono text-sm" data-testid="text-guest-order-id">
                  {order.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <Separator className="bg-slate-700" />
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Your Claim Code</p>
                <div className="bg-slate-900 rounded-lg p-4 text-center">
                  <p className="text-2xl font-mono font-bold text-amber-400 tracking-wider" data-testid="text-guest-claim-code">
                    {claimCode}
                  </p>
                </div>
                <p className="text-slate-500 text-xs">
                  Save this code! You'll need it when your product arrives to register and activate the QR code on your item.
                </p>
              </div>
              <Separator className="bg-slate-700" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300 text-sm">Confirmation sent to {order.buyerEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-300 text-sm">Typical delivery: 5-7 business days</span>
                </div>
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-300 text-sm">Scan the QR on your item when it arrives</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-900/20 border-amber-500/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-200 text-sm font-medium">Your custom design will be retained for 30 days</p>
                  <p className="text-amber-200/60 text-xs mt-1">Create a free account anytime to keep it forever and start earning from it.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/build">
              <Button className="w-full sm:w-auto bg-blue-500" data-testid="button-build-another">
                Build Another Product
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto border-slate-600 text-slate-300" data-testid="button-back-home">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const qrTypeLabel = order.qrType?.replace('qr-', 'QR ').replace(/^\w/, (c: string) => c.toUpperCase()) || 'QR Product';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 py-8 px-4">
      <SEO title="Order Confirmed | QR Gear" description="Your QR Gear order has been confirmed." />
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-order-confirmed">
            Order Confirmed!
          </h1>
          <p className="text-slate-400">Thank you for your purchase</p>
          {alreadyProcessed && (
            <Badge variant="secondary" className="mt-2">Already verified</Badge>
          )}
        </div>

        <Card className="bg-slate-800/80 border-slate-700">
          <CardContent className="pt-6 space-y-4">
            {(order.mockupUrl || order.lifestyleMockupUrl) && (
              <div className="rounded-lg overflow-hidden bg-slate-900">
                <img
                  src={order.lifestyleMockupUrl || order.mockupUrl || ""}
                  alt={order.productTitle}
                  className="w-full h-48 object-contain"
                  data-testid="img-order-mockup"
                />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <span className="text-white font-medium" data-testid="text-product-title">{order.productTitle}</span>
                <Badge variant="secondary">{qrTypeLabel}</Badge>
              </div>
              <div className="flex justify-between items-center gap-2 text-sm flex-wrap">
                <span className="text-slate-400">Color: {order.selectedColor} | Size: {order.selectedSize}</span>
              </div>
            </div>
            <Separator className="bg-slate-700" />
            <div className="flex justify-between items-center gap-2">
              <span className="text-white font-bold">Total Paid</span>
              <span className="text-blue-400 font-bold text-xl" data-testid="text-total-paid">
                ${Number(order.totalAmount).toFixed(2)}
              </span>
            </div>
            <Separator className="bg-slate-700" />
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">Your Claim Code</p>
              <div className="bg-slate-900 rounded-lg p-3 text-center">
                <p className="text-xl font-mono font-bold text-amber-400 tracking-wider" data-testid="text-claim-code">
                  {claimCode}
                </p>
              </div>
              <p className="text-slate-500 text-xs">
                You'll need this code when your product arrives. It lets you register and activate the QR code on your item.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-500/30">
          <CardContent className="pt-6 pb-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-amber-500/20 rounded-full p-2">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">Become a Member</h3>
                <p className="text-amber-200/70 text-sm">Unlock powerful perks for free</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" />
                <span className="text-slate-300 text-sm">Track your shipment in real time</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-slate-300 text-sm">Keep your custom graphic permanently</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-slate-300 text-sm">Turn your design into income</span>
              </div>
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300 text-sm">Manage your QR destination anytime</span>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap pt-2">
              <Button
                onClick={() => setChosenPath('member')}
                className="flex-1 bg-amber-500 text-black font-bold min-w-[140px]"
                data-testid="button-path-member"
              >
                <Crown className="w-4 h-4 mr-1" />
                Yes, Sign Me Up
              </Button>
              <Button
                onClick={() => setChosenPath('guest')}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 min-w-[140px]"
                data-testid="button-path-guest"
              >
                No Thanks
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
