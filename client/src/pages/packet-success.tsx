import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Package, ArrowRight, Mail, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface PacketOrder {
  id: string;
  packetId: string;
  productTitle: string;
  qrType: string;
  selectedColor: string;
  selectedSize: string;
  totalAmount: number;
  claimCode: string;
  buyerEmail: string;
  buyerName: string;
  mockupUrl: string | null;
  status: string;
  createdAt: string;
}

export default function PacketSuccessPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [claimCopied, setClaimCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get("session_id"));
  }, []);

  const { data, isLoading, error } = useQuery<{ success: boolean; order: PacketOrder; claimCode: string }>({
    queryKey: ["/api/public/packet-checkout/verify", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/public/packet-checkout/verify/${sessionId}`);
      if (!res.ok) throw new Error('Failed to verify checkout');
      return res.json();
    },
    enabled: !!sessionId,
  });

  const referrerId = localStorage.getItem('qrgear_referrer');
  const createYourOwnUrl = referrerId ? `/build?ref=${referrerId}` : '/build';

  const handleCopyClaimCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setClaimCopied(true);
      setTimeout(() => setClaimCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-slate-700 bg-slate-900/80">
            <CardContent className="p-6 text-center">
              <p className="text-slate-400">Invalid checkout session. Please try again.</p>
              <Link href="/store">
                <Button className="mt-4" data-testid="button-back-to-store">
                  Back to Store
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-slate-700 bg-slate-900/80">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-green-400" />
              <p className="text-slate-400">Confirming your order...</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !data?.order) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-slate-700 bg-slate-900/80">
            <CardContent className="p-6 text-center">
              <p className="text-slate-400">
                There was an issue confirming your order. If you were charged, please contact support.
              </p>
              <Link href="/">
                <Button className="mt-4" data-testid="button-go-home">
                  Go Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const order = data.order;
  const claimCode = data.claimCode || order.claimCode;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/50 mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-order-confirmed">
              Order Confirmed!
            </h1>
            <p className="text-slate-400">
              Thank you for your purchase. Your custom QR product is on its way.
            </p>
          </div>

          <Card className="border-slate-700 bg-slate-900/80">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-white">
                <Package className="w-5 h-5" />
                Order Details
              </CardTitle>
              <Badge variant="secondary" className="bg-green-900/50 text-green-400 border-green-700" data-testid="badge-order-status">
                {order.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Order Number</p>
                  <p className="font-mono font-medium text-white" data-testid="text-order-id">
                    {order.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date</p>
                  <p className="font-medium text-white" data-testid="text-order-date">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Separator className="bg-slate-700" />

              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-white">{order.productTitle}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {order.selectedColor && (
                      <Badge variant="outline" className="text-xs">
                        {order.selectedColor}
                      </Badge>
                    )}
                    {order.selectedSize && (
                      <Badge variant="outline" className="text-xs">
                        Size {order.selectedSize}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="font-bold text-green-400 text-lg" data-testid="text-order-total">
                  ${Number(order.totalAmount).toFixed(2)}
                </p>
              </div>

              {claimCode && (
                <>
                  <Separator className="bg-slate-700" />
                  <div className="bg-slate-800 rounded-md p-4 text-center">
                    <p className="text-sm text-slate-400 mb-2">Your Claim Code</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-2xl font-mono font-bold text-amber-400 tracking-wider" data-testid="text-claim-code">
                        {claimCode}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopyClaimCode(claimCode)}
                        data-testid="button-copy-claim"
                      >
                        {claimCopied ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Save this code — use it to register your product after creating an account
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-900/80">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-blue-900/30">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white mb-1">What happens next?</p>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>1. Your order is being sent to our production partner</li>
                    <li>2. Your custom QR product will be printed and quality checked</li>
                    <li>3. You'll receive shipping updates via email</li>
                    <li>4. Typical delivery time is 5-7 business days</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-gradient-to-r from-amber-900/20 to-green-900/20">
            <CardContent className="p-6 text-center space-y-3">
              <Sparkles className="h-8 w-8 mx-auto text-amber-400" />
              <h2 className="text-lg font-bold text-white" data-testid="text-create-own-heading">
                Love it? Create your own!
              </h2>
              <p className="text-slate-400 text-sm">
                Design custom QR merchandise and earn 25% on every sale. Forever.
              </p>
              <Link href={createYourOwnUrl}>
                <Button variant="outline" className="mt-2 border-amber-500/30 text-amber-400" data-testid="button-create-your-own">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Creating
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
