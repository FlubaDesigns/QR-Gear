import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, QrCode, ArrowLeft, ShoppingCart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface PublicPacketData {
  id: string;
  title: string;
  description: string;
  itemImage: string | null;
  retailPrice: number | null;
  productTitle: string;
  productImage: string | null;
  selectedColor: string | null;
  selectedShirtSize: string | null;
  qrType: string | null;
  memberId: string | null;
  status: string;
}

const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const DEFAULT_SIZE_UPCHARGES: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };

function getQrTypeLabel(qrType: string | null): string {
  switch (qrType) {
    case 'qr-basic': return 'QR Basic';
    case 'qr-plus': return 'QR Plus';
    case 'qr-canvas': return 'QR Canvas';
    case 'qr-play': return 'QR Play';
    case 'qr-compose': return 'QR Compose';
    default: return 'QR Gear';
  }
}

function captureReferral() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('qrgear_referrer', ref);
    localStorage.setItem('qrgear_referrer_ts', new Date().toISOString());
  }
  return ref || localStorage.getItem('qrgear_referrer');
}

export default function PacketPage() {
  const [match, params] = useRoute("/p/:id");
  const packetId = params?.id;
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string>('');

  useEffect(() => {
    captureReferral();
  }, []);

  const { data, isLoading, error } = useQuery<{ success: boolean; packet: PublicPacketData }>({
    queryKey: ["/api/public/member-packet", packetId],
    enabled: !!packetId,
  });

  const { data: pricingData } = useQuery<{ sizeUpcharges?: Record<string, number> }>({
    queryKey: ["/api/pricing-settings"],
  });

  const sizeUpcharges = pricingData?.sizeUpcharges || DEFAULT_SIZE_UPCHARGES;

  const packet = data?.packet;
  const referrerId = localStorage.getItem('qrgear_referrer');

  useEffect(() => {
    if (packet?.selectedShirtSize && !selectedSize) {
      setSelectedSize(packet.selectedShirtSize);
    } else if (!selectedSize) {
      setSelectedSize('M');
    }
  }, [packet]);

  const basePrice = packet?.retailPrice || 0;
  const sizeUpcharge = sizeUpcharges[selectedSize] || 0;
  const totalPrice = Math.round((basePrice + sizeUpcharge) * 100) / 100;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      setCheckoutError('');
      const response = await fetch('/api/public/packet-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packetId,
          selectedShirtSize: selectedSize,
          referrerId: referrerId || undefined,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create checkout');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      setCheckoutError(err.message);
    },
  });

  if (!match || !packetId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2" data-testid="text-not-found">Content Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The content you're looking for doesn't exist or the link is invalid.
            </p>
            <Link href="/">
              <Button variant="outline" data-testid="button-go-home">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" data-testid="loader-packet" />
      </div>
    );
  }

  if (error || !packet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-900 to-black">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2" data-testid="text-load-error">Content Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This content could not be loaded.
            </p>
            <Link href="/">
              <Button variant="outline" data-testid="button-go-home-error">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const createYourOwnUrl = referrerId 
    ? `/build?ref=${referrerId}`
    : '/build';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-900 to-black">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="max-w-lg w-full space-y-6">
          <Card className="overflow-hidden border-slate-700 bg-slate-900/80">
            <CardContent className="p-0">
              {packet.itemImage && (
                <div className="relative bg-black flex items-center justify-center p-6">
                  <img
                    src={packet.itemImage}
                    alt={packet.title}
                    className="max-w-full max-h-80 object-contain rounded"
                    data-testid="img-packet-product"
                  />
                  {packet.qrType && (
                    <Badge className="absolute top-3 right-3" data-testid="badge-qr-type">
                      {getQrTypeLabel(packet.qrType)}
                    </Badge>
                  )}
                </div>
              )}

              <div className="p-6 space-y-4">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-packet-title">
                    {packet.title}
                  </h1>
                  {packet.description && (
                    <p className="text-slate-400 text-sm" data-testid="text-packet-description">
                      {packet.description}
                    </p>
                  )}
                </div>

                {totalPrice > 0 && (
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-green-400" data-testid="text-packet-price">
                      ${totalPrice.toFixed(2)}
                    </p>
                    {sizeUpcharge > 0 && (
                      <span className="text-sm text-slate-500">
                        (includes ${sizeUpcharge.toFixed(2)} size upcharge)
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Size</label>
                    <Select value={selectedSize} onValueChange={setSelectedSize}>
                      <SelectTrigger data-testid="select-size">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_SIZES.map((size) => (
                          <SelectItem key={size} value={size} data-testid={`select-size-${size}`}>
                            {size}
                            {(sizeUpcharges[size] || 0) > 0 ? ` (+$${(sizeUpcharges[size] || 0).toFixed(2)})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {packet.selectedColor && (
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" data-testid="badge-color">
                        {packet.selectedColor}
                      </Badge>
                    </div>
                  )}
                </div>

                {checkoutError && (
                  <p className="text-red-400 text-sm" data-testid="text-checkout-error">
                    {checkoutError}
                  </p>
                )}

                <div className="space-y-3 pt-2">
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                    onClick={() => checkoutMutation.mutate()}
                    disabled={checkoutMutation.isPending || !selectedSize}
                    data-testid="button-buy-now"
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-5 w-5 mr-2" />
                    )}
                    {checkoutMutation.isPending ? 'Creating checkout...' : `Buy Now — $${totalPrice.toFixed(2)}`}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-gradient-to-r from-amber-900/20 to-green-900/20">
            <CardContent className="p-6 text-center space-y-3">
              <Sparkles className="h-8 w-8 mx-auto text-amber-400" />
              <h2 className="text-lg font-bold text-white" data-testid="text-create-own-heading">
                Want to create your own?
              </h2>
              <p className="text-slate-400 text-sm">
                Design custom QR merchandise and earn 25% on every sale. Forever.
              </p>
              <Link href={createYourOwnUrl}>
                <Button variant="outline" className="mt-2 border-amber-500/30 text-amber-400" data-testid="button-create-your-own">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Your Own
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
