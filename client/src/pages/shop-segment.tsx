import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Store, Star, Sparkles, QrCode, Check } from "lucide-react";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MockupsByColor {
  [color: string]: {
    front?: string;
    angles?: string[];
  };
}

interface StoreProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  segment: string | null;
  isFeatured: boolean;
  isSeasonalPromo: boolean;
  templateVariant: string | null;
  qrProductType: string;
  qrCodeUrl?: string | null;
  selectedColors?: string[] | null;
  defaultColor?: string | null;
  mockupsByColor?: MockupsByColor | null;
  createdAt: string;
}

// Color name to hex mapping
function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    'White': '#FFFFFF',
    'Black': '#000000',
    'Navy': '#000080',
    'Navy Blue': '#000080',
    'Royal Blue': '#4169E1',
    'Red': '#DC2626',
    'Heather Gray': '#9CA3AF',
    'Heather Grey': '#9CA3AF',
    'Sport Gray': '#6B7280',
    'Sport Grey': '#6B7280',
    'Dark Heather': '#374151',
    'Charcoal': '#36454F',
    'Natural': '#F5F5DC',
    'Sand': '#C2B280',
    'Forest Green': '#228B22',
    'Kelly Green': '#4CBB17',
    'Maroon': '#800000',
    'Orange': '#FF6B00',
    'Gold': '#FFD700',
    'Yellow': '#FFFF00',
    'Light Blue': '#ADD8E6',
    'Pink': '#FFC0CB',
    'Purple': '#800080',
    'Ash': '#B2BEB5',
  };
  return colorMap[colorName] || '#CCCCCC';
}

// Map product type codes to display labels
const QR_PRODUCT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "qr-basics": { label: "QR Basics", color: "bg-slate-500" },
  "qr-plus": { label: "QR Plus", color: "bg-blue-500" },
  "qr-canvas": { label: "QR Canvas", color: "bg-purple-500" },
  "qr-play": { label: "QR Play", color: "bg-rose-500" },
  "qr-dynamics": { label: "QR Dynamics™", color: "bg-emerald-500" },
};

interface StoreResponse {
  storeType: string;
  storeName: string;
  segment: string | null;
  products: StoreProduct[];
}

// Product card with QR overlay and color swatches
function StoreProductCard({ product, storeType, storeName }: { product: StoreProduct; storeType: string; storeName: string }) {
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.defaultColor || null
  );
  const [generatingColor, setGeneratingColor] = useState<string | null>(null);
  const [generatedColors, setGeneratedColors] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const availableColors = product.selectedColors || 
    (product.mockupsByColor ? Object.keys(product.mockupsByColor) : []);

  // Debug log
  console.log('[ProductCard]', product.id, 'colors:', availableColors, 'defaultColor:', product.defaultColor);

  // Mockup generation mutation
  const generateMockup = useMutation({
    mutationFn: async (color: string) => {
      // Send the product ID as-is - backend handles the custom_ prefix
      const res = await apiRequest("POST", "/api/storefront/generate-mockup", {
        productId: product.id,
        color,
      });
      return res.json();
    },
    onMutate: (color) => {
      setGeneratingColor(color);
    },
    onSuccess: (data, color) => {
      setGeneratingColor(null);
      setGeneratedColors(prev => new Set(Array.from(prev).concat(color)));
      toast({
        title: "Mockup generated!",
        description: `${color} mockup is now available.`,
      });
      // Refresh store data
      queryClient.invalidateQueries({ queryKey: ["/api/store", storeType, storeName] });
    },
    onError: (error: any, color) => {
      setGeneratingColor(null);
      toast({
        title: "Mockup generation failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const getCurrentImage = (): string | null => {
    // If we have mockups for colors, use the selected color's mockup
    if (product.mockupsByColor) {
      const color = selectedColor || product.defaultColor || availableColors[0];
      if (color && product.mockupsByColor[color]?.front) {
        return product.mockupsByColor[color].front!;
      }
    }
    return product.imageUrl;
  };

  const displayImage = getCurrentImage();
  const hasMockups = !!product.mockupsByColor && Object.keys(product.mockupsByColor).length > 0;

  return (
    <Card 
      className="hover-elevate cursor-pointer h-full flex flex-col overflow-hidden"
      data-testid={`card-product-${product.id}`}
    >
      <div className="aspect-square relative bg-muted">
        {displayImage ? (
          <img 
            src={displayImage} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <QrCode className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
        {/* QR Code overlay - show when no mockups available */}
        {!hasMockups && product.qrCodeUrl && (
          <img
            src={product.qrCodeUrl}
            alt="QR Code"
            className="product-card-qr-overlay"
          />
        )}
        {(product.isFeatured || product.isSeasonalPromo) && (
          <div className="absolute top-2 left-2 flex gap-1">
            {product.isFeatured && (
              <Badge variant="default" className="gap-1">
                <Star className="h-3 w-3" />
                Featured
              </Badge>
            )}
            {product.isSeasonalPromo && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                Promo
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Color swatches with mockup generation stars */}
      {availableColors.length > 0 && (
        <div className="product-card-colors">
          {availableColors.map((color) => {
            const isDefault = color === product.defaultColor;
            const isSelected = selectedColor === color;
            const hasMockupForColor = product.mockupsByColor?.[color]?.front;
            const isGenerating = generatingColor === color;
            const wasGenerated = generatedColors.has(color);
            
            return (
              <div key={color} className="swatch-container">
                <button
                  className={`color-swatch ${isSelected ? 'selected' : ''} ${isDefault ? 'is-default' : ''}`}
                  style={{ backgroundColor: getColorHex(color) }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedColor(color);
                  }}
                  title={color}
                  data-testid={`swatch-${color.toLowerCase().replace(/\s+/g, '-')}`}
                />
                {/* Star button for mockup generation */}
                <button
                  className={`mockup-star-btn ${hasMockupForColor || wasGenerated ? 'has-mockup' : ''} ${isGenerating ? 'is-loading' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isGenerating && !hasMockupForColor) {
                      generateMockup.mutate(color);
                    }
                  }}
                  disabled={isGenerating || !!hasMockupForColor}
                  title={hasMockupForColor ? `${color} mockup ready` : isGenerating ? 'Generating...' : `Generate ${color} mockup`}
                  data-testid={`star-${color.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {isGenerating ? (
                    <Loader2 className="mockup-star-icon spin" />
                  ) : hasMockupForColor || wasGenerated ? (
                    <Check className="mockup-star-icon check" />
                  ) : (
                    <Star className="mockup-star-icon" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
      
      <CardContent className="flex-1 p-4">
        <h3 className="font-semibold text-lg line-clamp-2" data-testid={`text-product-name-${product.id}`}>
          {product.name}
        </h3>
        {product.qrProductType && QR_PRODUCT_TYPE_LABELS[product.qrProductType] && (
          <Badge 
            className={`mt-2 text-xs text-white ${QR_PRODUCT_TYPE_LABELS[product.qrProductType].color}`}
            data-testid={`badge-product-type-${product.id}`}
          >
            {QR_PRODUCT_TYPE_LABELS[product.qrProductType].label}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShopSegmentPage() {
  const params = useParams<{ storeType: string; storeName: string; segment?: string }>();
  
  const storeType = params.storeType || "Internal";
  const storeName = decodeURIComponent(params.storeName || "");
  const segment = params.segment ? decodeURIComponent(params.segment) : undefined;
  
  const apiUrl = segment 
    ? `/api/store/${storeType}/${encodeURIComponent(storeName)}?segment=${encodeURIComponent(segment)}`
    : `/api/store/${storeType}/${encodeURIComponent(storeName)}`;
  
  const { data, isLoading, error } = useQuery<StoreResponse>({
    queryKey: ["/api/store", storeType, storeName, segment],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to load store products");
      return res.json();
    },
    enabled: !!storeName,
  });

  if (!storeName) {
    return (
      <div className="container max-w-6xl py-8 px-4">
        <div className="text-center py-16">
          <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-4">Please select a valid store to browse.</p>
          <Link href="/">
            <Button className="h-12" data-testid="button-go-home">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading products...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-6xl py-8 px-4">
        <div className="text-center py-16">
          <Store className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Error Loading Store</h1>
          <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
          <Link href="/">
            <Button className="h-12" data-testid="button-go-home-error">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayTitle = segment 
    ? `${storeName} - ${segment}` 
    : storeName;

  return (
    <div className="container max-w-6xl py-8 px-4">
      <BreadcrumbTrail />
      <Link href="/">
        <Button 
          variant="ghost" 
          className="mb-6 h-12 px-4"
          data-testid="button-back-home"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Home
        </Button>
      </Link>

      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">{displayTitle}</h1>
        </div>
        {segment && (
          <p className="text-muted-foreground">
            Showing products in the "{segment}" section
          </p>
        )}
      </div>

      {data?.products.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground mb-2">No products available yet</p>
            <p className="text-sm text-muted-foreground">
              Check back soon for new QR Gear products!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.products.map((product) => (
            <Link key={product.id} href={`/customs/${product.id}`}>
              <StoreProductCard product={product} storeType={storeType} storeName={storeName} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
