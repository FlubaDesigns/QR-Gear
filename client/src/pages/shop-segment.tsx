import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Store, Star, Sparkles, QrCode, ShoppingCart } from "lucide-react";
import ProductImageGallery from "@/components/ProductImageGallery";
import { buildMockupGalleryImages } from "@/lib/mockup-gallery";

interface MockupsByColor {
  [color: string]: {
    front?: string;
    lifestyle?: string;
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
  availableSizes?: string[] | null;
  defaultColor?: string | null;
  mockupsByColor?: MockupsByColor | null;
  price?: number | null;
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

function StoreProductCard({ product }: { product: StoreProduct }) {
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.defaultColor || null
  );

  const availableColors = product.selectedColors || 
    (product.mockupsByColor ? Object.keys(product.mockupsByColor) : []);
  const availableSizes = product.availableSizes || [];

  const galleryImages = useMemo(() => {
    return buildMockupGalleryImages(product, selectedColor);
  }, [product, selectedColor]);
  
  const displayImage = galleryImages[0]?.url || product.imageUrl;
  const hasMockups = !!product.mockupsByColor && Object.keys(product.mockupsByColor).length > 0;

  return (
    <Card 
      className="hover-elevate cursor-pointer h-full flex flex-col overflow-visible"
      data-testid={`card-product-${product.id}`}
    >
      <div 
        className="aspect-square relative bg-muted rounded-t-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {galleryImages.length > 0 ? (
          <ProductImageGallery images={galleryImages} />
        ) : displayImage ? (
          <ProductImageGallery images={[{ url: displayImage, alt: product.name }]} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <QrCode className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
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
      
      <CardContent className="flex-1 p-4 flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-lg line-clamp-2" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {product.price != null && product.price > 0 && (
              <span className="text-xl font-bold text-foreground" data-testid={`text-price-${product.id}`}>
                ${product.price.toFixed(2)}
              </span>
            )}
            {product.qrProductType && QR_PRODUCT_TYPE_LABELS[product.qrProductType] && (
              <Badge 
                className={`text-xs text-white ${QR_PRODUCT_TYPE_LABELS[product.qrProductType].color}`}
                data-testid={`badge-product-type-${product.id}`}
              >
                {QR_PRODUCT_TYPE_LABELS[product.qrProductType].label}
              </Badge>
            )}
          </div>
        </div>

        {availableColors.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">
              {selectedColor || "Select color"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableColors.slice(0, 10).map((color) => {
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      isSelected 
                        ? 'border-primary ring-2 ring-primary/30' 
                        : 'border-border'
                    }`}
                    style={{ backgroundColor: getColorHex(color) }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedColor(color);
                    }}
                    title={color}
                    data-testid={`swatch-${color.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                );
              })}
              {availableColors.length > 10 && (
                <span className="text-xs text-muted-foreground self-center ml-1">
                  +{availableColors.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}

        {availableSizes.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Sizes</span>
            <div className="flex flex-wrap gap-1">
              {availableSizes.map((size) => (
                <Badge key={size} variant="outline" className="text-xs" data-testid={`badge-size-${size.toLowerCase()}`}>
                  {size}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button
            className="w-full gap-2"
            data-testid={`button-shop-${product.id}`}
          >
            <ShoppingCart className="h-4 w-4" />
            {product.price != null && product.price > 0
              ? `Shop — $${product.price.toFixed(2)}`
              : "View Product"}
          </Button>
        </div>
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
            <Link key={product.id} href={`/shop/product/${product.id}`}>
              <StoreProductCard product={product} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
