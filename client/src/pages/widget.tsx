import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { nexusFetch } from "@/lib/nexusFetch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingBag, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

interface WidgetSession {
  businessName: string;
  businessLogoUrl?: string;
  kcListingUrl: string;
  qrCodeDataUrl: string;
  segment?: string | null;
  totalProducts?: number;
  products: Array<{
    id: string;
    name: string;
    imageUrl: string;
    basePrice: string;
    category: string;
    segment?: string;
    mockupsByColor?: Record<string, { front?: string; lifestyle?: string }>;
  }>;
}

const ALLOWED_ORIGINS = (import.meta.env.VITE_ALLOWED_WIDGET_ORIGINS || 'https://kingdomconnects.com').split(',');

function notifyParent(type: string, data?: Record<string, unknown>) {
  if (window.parent !== window) {
    const targetOrigin = ALLOWED_ORIGINS[0] || 'https://kingdomconnects.com';
    window.parent.postMessage({ type, ...data }, targetOrigin);
  }
}

export default function Widget() {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [segment, setSegment] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [theme, setTheme] = useState<string>('auto');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const segmentParam = params.get("segment");
    const compactParam = params.get("compact");
    const themeParam = params.get("theme");
    
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      toast({
        title: "Invalid Widget",
        description: "No authentication token provided",
        variant: "destructive",
      });
    }
    
    setSegment(segmentParam);
    setCompact(compactParam === 'true');
    setTheme(themeParam || 'auto');
  }, [toast]);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          notifyParent('qrgear-resize', { height: entry.contentRect.height + 40 });
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const { data: session, isLoading, error } = useQuery<WidgetSession>({
    queryKey: ["/api/widget/session", { token, segment }],
    queryFn: async () => {
      let url = `/api/widget/session?token=${encodeURIComponent(token!)}`;
      if (segment) {
        url += `&segment=${encodeURIComponent(segment)}`;
      }
      const res = await nexusFetch(url, { source: "widget:session", tries: 3 });
      if (!res.ok) throw new Error('Failed to load session');
      return res.json();
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Widget Error",
        description: "Failed to load widget session",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleOrderClick = (productId: string) => {
    if (!token) return;
    
    const checkoutUrl = `/creator?token=${encodeURIComponent(token)}&product=${productId}`;
    
    notifyParent('qrgear-widget-navigate', { url: checkoutUrl });
    
    if (window.parent === window) {
      window.location.href = checkoutUrl;
    }
  };

  useEffect(() => {
    if (session) {
      notifyParent('qrgear-ready');
    }
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading widget...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-destructive">Widget Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            Unable to load QR Gear widget. Please check your authentication token.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${compact ? 'p-4' : 'p-6 min-h-screen'}`}
    >
      <BreadcrumbTrail />
      <div className={`mx-auto space-y-6 ${compact ? 'max-w-full' : 'max-w-5xl'}`}>
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {session.businessLogoUrl && (
                <img 
                  src={session.businessLogoUrl} 
                  alt={session.businessName}
                  className="h-12 w-12 object-contain rounded-lg"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-foreground">{session.businessName}</h1>
                <p className="text-sm text-muted-foreground">Custom Promotional Merchandise</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Powered by</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">Kingdom Connects</span>
                <span className="text-muted-foreground">×</span>
                <span className="text-sm font-semibold text-blue-600">QR Gear</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Your Custom QR Code</h2>
              <p className="text-sm text-muted-foreground">
                All products feature a QR code linking to your Kingdom Connects business listing
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(session.kcListingUrl, "_blank")}
                data-testid="button-view-listing"
              >
                <ExternalLink className="w-4 h-4" />
                View Your Listing
              </Button>
            </div>
            
            <div className="flex justify-center">
              <div className="glass-card p-4 rounded-xl inline-block">
                <img 
                  src={session.qrCodeDataUrl} 
                  alt="Business QR Code"
                  className="w-48 h-48 object-contain"
                  data-testid="img-qr-preview"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4 text-foreground">Featured Products</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {session.products.map((product) => (
              <Card 
                key={product.id} 
                className="overflow-hidden hover-elevate"
                data-testid={`card-product-${product.id}`}
              >
                <div className="aspect-square bg-muted relative">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="absolute top-2 right-2 glass-card px-2 py-1 rounded-md">
                    <span className="text-xs font-semibold text-foreground">Co-branded</span>
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground" data-testid={`text-product-name-${product.id}`}>
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground capitalize">{product.category}</p>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Starting at</p>
                      <p className="text-lg font-bold text-foreground" data-testid={`text-price-${product.id}`}>
                        ${product.basePrice}
                      </p>
                    </div>
                    
                    <Button
                      onClick={() => handleOrderClick(product.id)}
                      size="sm"
                      className="gap-2"
                      data-testid={`button-order-${product.id}`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Order
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Includes: Your logo + QR code + KC badge + QR Gear tag
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 text-center text-sm text-muted-foreground">
          Leave-behind marketing that works. Give customers branded merch they'll actually use.
        </div>
      </div>
    </div>
  );
}
