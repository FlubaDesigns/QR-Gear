import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, ShoppingCart, ArrowLeft } from "lucide-react";

interface LandingPageData {
  packetId: string;
  title: string;
  description: string;
  backgroundUrl: string | null;
  compositeUrl: string | null;
  qrOnlyUrl: string | null;
  qrContent: string | null;
  productName: string | null;
  productImageUrl: string | null;
  headerStyle: any | null;
  footerStyle: any | null;
  pricing: any | null;
  createdAt: string | null;
}

export default function ProductLanding() {
  const params = useParams();
  const slug = params.slug as string;
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<{ success: boolean; landingPage: LandingPageData }>({
    queryKey: ['/api/test/landing', slug],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This product page doesn't exist or has been removed.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const landing = data.landingPage;
  const hasQrContent = landing.qrContent && landing.qrContent.trim() !== '';

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: landing.backgroundUrl ? `url(${landing.backgroundUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-black/40">
        <Card className="max-w-lg w-full bg-background/95 backdrop-blur">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2" data-testid="text-landing-title">
                {landing.title}
              </h1>
              {landing.description && (
                <p className="text-muted-foreground" data-testid="text-landing-description">
                  {landing.description}
                </p>
              )}
            </div>

            {landing.compositeUrl && (
              <div className="flex justify-center">
                <img
                  src={landing.compositeUrl}
                  alt={landing.title}
                  className="max-h-64 rounded-lg shadow-md"
                  data-testid="img-landing-composite"
                />
              </div>
            )}

            {landing.qrOnlyUrl && (
              <div className="flex justify-center">
                <img
                  src={landing.qrOnlyUrl}
                  alt="QR Code"
                  className="h-32 w-32 rounded border bg-white p-2"
                  data-testid="img-landing-qr"
                />
              </div>
            )}

            {hasQrContent && (
              <div className="flex flex-col items-center gap-3">
                <Button
                  size="lg"
                  onClick={() => window.open(landing.qrContent!, '_blank')}
                  data-testid="button-visit-link"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Visit Link
                </Button>
                <p className="text-xs text-muted-foreground break-all max-w-full text-center">
                  {landing.qrContent}
                </p>
              </div>
            )}

            {landing.pricing && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Price</span>
                  <span className="text-2xl font-bold text-primary" data-testid="text-landing-price">
                    ${landing.pricing.customerPrice?.toFixed(2) || landing.pricing.total?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-browse-store"
              >
                Browse Store
              </Button>
              <Button
                onClick={() => setLocation("/cart")}
                data-testid="button-view-cart"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                View Cart
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-white/70 text-sm mt-6">
          Powered by QR Gear
        </p>
      </div>
    </div>
  );
}
