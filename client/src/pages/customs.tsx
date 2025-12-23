import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, QrCode, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { CustomDesign } from "@shared/schema";

export default function CustomsPage() {
  const [match, params] = useRoute("/customs/:id");
  const designId = params?.id;

  const { data: design, isLoading, error } = useQuery<CustomDesign>({
    queryKey: ["/api/customs", designId],
    enabled: !!designId,
  });

  if (!match || !designId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">Custom Design Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The design you're looking for doesn't exist or the link is invalid.
            </p>
            <Link href="/">
              <Button variant="outline">
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !design) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">Design Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This custom design could not be loaded.
            </p>
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const topText = design.topText as { text: string; fontFamily: string; fontSize: string } | null;
  const bottomText = design.bottomText as { text: string; fontFamily: string; fontSize: string } | null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Design Preview */}
            <div className="relative aspect-square bg-muted flex items-center justify-center">
              {design.backgroundImageUrl ? (
                <img 
                  src={design.backgroundImageUrl} 
                  alt="Custom design background"
                  className="w-full h-full object-cover"
                />
              ) : design.productImage ? (
                <img 
                  src={design.productImage} 
                  alt={design.productName}
                  className="w-full h-full object-contain p-8"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <QrCode className="h-24 w-24 mx-auto mb-4" />
                  <p>Custom Design</p>
                </div>
              )}
              
              {/* Text overlays */}
              <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
                {topText && (
                  <div 
                    className="text-center"
                    style={{
                      fontFamily: topText.fontFamily,
                      fontSize: `${topText.fontSize}px`,
                      textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                      color: "white",
                    }}
                  >
                    {topText.text}
                  </div>
                )}
                {bottomText && (
                  <div 
                    className="text-center"
                    style={{
                      fontFamily: bottomText.fontFamily,
                      fontSize: `${bottomText.fontSize}px`,
                      textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                      color: "white",
                    }}
                  >
                    {bottomText.text}
                  </div>
                )}
              </div>
            </div>
            
            {/* Design Info */}
            <div className="p-6 space-y-4">
              <h1 className="text-2xl font-bold" data-testid="text-design-name">
                {design.productName}
              </h1>
              
              <div className="flex flex-wrap gap-2">
                {design.isFeatured && (
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded text-sm">
                    Featured
                  </span>
                )}
                {design.isSeasonalPromo && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-400 rounded text-sm">
                    Seasonal Promo
                  </span>
                )}
                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                  {design.placement}
                </span>
              </div>
              
              {design.storeName && (
                <p className="text-sm text-muted-foreground">
                  Available at: {design.storeName}
                </p>
              )}
              
              {/* QR Code Display */}
              {design.qrCodeUrl && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img 
                    src={design.qrCodeUrl} 
                    alt="QR Code"
                    className="w-32 h-32"
                    data-testid="img-qr-code"
                  />
                </div>
              )}
              
              <div className="pt-4 border-t">
                <Link href="/store">
                  <Button className="w-full" data-testid="button-shop-now">
                    Shop Now
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
