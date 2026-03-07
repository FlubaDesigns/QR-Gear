import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2, QrCode, ArrowLeft, ShoppingCart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    captureReferral();
  }, []);

  const { data, isLoading, error } = useQuery<{ success: boolean; packet: PublicPacketData }>({
    queryKey: ["/api/public/member-packet", packetId],
    enabled: !!packetId,
  });

  const packet = data?.packet;
  const referrerId = localStorage.getItem('qrgear_referrer');

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
                    <Badge className="absolute top-3 right-3 bg-slate-800/80 text-slate-300 border-slate-600" data-testid="badge-qr-type">
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

                {packet.retailPrice != null && packet.retailPrice > 0 && (
                  <p className="text-3xl font-bold text-green-400" data-testid="text-packet-price">
                    ${packet.retailPrice.toFixed(2)}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {packet.selectedColor && (
                    <Badge variant="secondary" data-testid="badge-color">
                      {packet.selectedColor}
                    </Badge>
                  )}
                  {packet.selectedShirtSize && (
                    <Badge variant="secondary" data-testid="badge-size">
                      {packet.selectedShirtSize}
                    </Badge>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <Link href={`/store${referrerId ? `?ref=${referrerId}` : ''}`}>
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-lg py-6" data-testid="button-buy-now">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Shop Now
                    </Button>
                  </Link>
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
