import { useState, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, ArrowRight, Store, Star, Sparkles, QrCode, ShoppingCart, Flag } from "lucide-react";
import ProductImageGallery from "@/components/ProductImageGallery";
import { buildMockupGalleryImages } from "@/lib/mockup-gallery";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StorefrontLayout from "@/components/StorefrontLayout";

// ---- Types ----

interface MockupsByColor {
  [color: string]: { front?: string; lifestyle?: string; angles?: string[] };
}

interface StoreProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  packetImageUrl?: string | null;
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

interface StoreResponse {
  storeType: string;
  storeName: string;
  segment: string | null;
  channelId?: string | null;
  channelName?: string | null;
  collection?: string | null;
  products: StoreProduct[];
}

// ---- USA 250 collection definitions ----

const USA250_COLLECTIONS = [
  {
    id: "monuments",
    label: "Monuments",
    description: "Iconic landmarks and national monuments.",
  },
  {
    id: "armed-forces",
    label: "Armed Forces",
    description: "Honoring those who serve and have served.",
  },
  {
    id: "founding-fathers",
    label: "Founding Fathers",
    description: "The visionaries who built a nation.",
  },
];

function getCollectionLabel(id: string): string {
  return USA250_COLLECTIONS.find((c) => c.id === id)?.label ?? id;
}

// ---- Color helpers ----

function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    White: "#FFFFFF", Black: "#000000", Navy: "#000080",
    "Navy Blue": "#000080", "Royal Blue": "#4169E1", Red: "#DC2626",
    "Heather Gray": "#9CA3AF", "Heather Grey": "#9CA3AF",
    "Sport Gray": "#6B7280", "Sport Grey": "#6B7280",
    "Dark Heather": "#374151", Charcoal: "#36454F", Natural: "#F5F5DC",
    Sand: "#C2B280", "Forest Green": "#228B22", "Kelly Green": "#4CBB17",
    Maroon: "#800000", Orange: "#FF6B00", Gold: "#FFD700",
    Yellow: "#FFFF00", "Light Blue": "#ADD8E6", Pink: "#FFC0CB",
    Purple: "#800080", Ash: "#B2BEB5",
  };
  return colorMap[colorName] || "#CCCCCC";
}

const QR_PRODUCT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "qr-basics": { label: "QR Basics", color: "bg-slate-500" },
  "qr-plus": { label: "QR Plus", color: "bg-blue-500" },
  "qr-canvas": { label: "QR Canvas", color: "bg-purple-500" },
  "qr-play": { label: "QR Play", color: "bg-rose-500" },
  "qr-dynamics": { label: "QR Dynamics™", color: "bg-emerald-500" },
};

// ---- Product card ----

function StoreProductCard({ product }: { product: StoreProduct }) {
  const [selectedColor, setSelectedColor] = useState<string>(product.defaultColor || "");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [addingToCart, setAddingToCart] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [, setLocation] = useLocation();

  const availableColors = product.selectedColors ||
    (product.mockupsByColor ? Object.keys(product.mockupsByColor) : []);
  const availableSizes = product.availableSizes || [];

  const galleryImages = useMemo(() => {
    // If mockupsByColor is populated, use the standard color-based gallery
    if (product.mockupsByColor && Object.keys(product.mockupsByColor).length > 0) {
      return buildMockupGalleryImages(product, selectedColor || null);
    }
    // Otherwise build a two-image gallery: lifestyle photo first, QR graphic second
    const images: { url: string; alt: string }[] = [];
    if (product.imageUrl) images.push({ url: product.imageUrl, alt: product.name });
    if (product.packetImageUrl && product.packetImageUrl !== product.imageUrl) {
      images.push({ url: product.packetImageUrl, alt: `${product.name} — graphic` });
    }
    return images;
  }, [product, selectedColor]);

  const displayImage = galleryImages[0]?.url || product.imageUrl;
  const hasMockups = !!product.mockupsByColor && Object.keys(product.mockupsByColor).length > 0;
  const canAddToCart = !!selectedSize && !!selectedColor && product.price != null && product.price > 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canAddToCart || !product.price) return;
    setAddingToCart(true);
    try {
      const res = await fetch(`/api/store/product/${product.id}/add-to-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedColor, selectedSize, quantity: 1 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add to cart" }));
        throw new Error(err.error || "Failed to add to cart");
      }
      const resolved = await res.json();
      const cartData = {
        productId: resolved.productId,
        quantity: resolved.quantity,
        price: resolved.price.toFixed(2),
        customization: {
          productId: resolved.productId,
          productName: resolved.name,
          productImage: resolved.imageUrl || displayImage || product.imageUrl,
          productColor: resolved.selectedColor,
          productSize: resolved.selectedSize,
          qrType: product.qrProductType,
          linkId: resolved.linkId,
        },
      };
      if (isAuthenticated) {
        await apiRequest("POST", "/api/cart", cartData);
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      } else {
        addItem(cartData);
      }
      toast({
        title: "Added to cart",
        description: `${product.name} (${selectedColor}, ${selectedSize}) added to your cart.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to add to cart",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-visible" data-testid={`card-product-${product.id}`}>
      <Link href={`/shop/product/${product.id}`}>
        <div className="aspect-square relative bg-muted rounded-t-md overflow-hidden cursor-pointer">
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
            <img src={product.qrCodeUrl} alt="QR Code" className="product-card-qr-overlay" />
          )}
          {(product.isFeatured || product.isSeasonalPromo) && (
            <div className="absolute top-2 left-2 flex gap-1">
              {product.isFeatured && (
                <Badge variant="default" className="gap-1">
                  <Star className="h-3 w-3" /> Featured
                </Badge>
              )}
              {product.isSeasonalPromo && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" /> Promo
                </Badge>
              )}
            </div>
          )}
        </div>
      </Link>

      <CardContent className="flex-1 p-4 flex flex-col gap-3">
        <div>
          <Link href={`/shop/product/${product.id}`}>
            <h3 className="font-semibold text-lg line-clamp-2 cursor-pointer hover:underline"
              data-testid={`text-product-name-${product.id}`}>
              {product.name}
            </h3>
          </Link>
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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Color</label>
            <Select value={selectedColor} onValueChange={setSelectedColor}>
              <SelectTrigger data-testid={`select-color-${product.id}`}>
                <SelectValue placeholder="Select color" />
              </SelectTrigger>
              <SelectContent>
                {availableColors.map((color) => (
                  <SelectItem
                    key={color}
                    value={color}
                    data-testid={`option-color-${color.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-border inline-block flex-shrink-0"
                        style={{ backgroundColor: getColorHex(color) }}
                      />
                      <span>{color}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {availableSizes.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Size</label>
            <Select value={selectedSize} onValueChange={setSelectedSize}>
              <SelectTrigger data-testid={`select-size-${product.id}`}>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {availableSizes.map((size) => (
                  <SelectItem
                    key={size}
                    value={size}
                    data-testid={`option-size-${size.toLowerCase()}`}
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button
            className="w-full gap-2"
            disabled={!canAddToCart || addingToCart}
            onClick={handleAddToCart}
            data-testid={`button-add-to-cart-${product.id}`}
          >
            {addingToCart ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            {canAddToCart
              ? `Add to Cart — $${product.price!.toFixed(2)}`
              : "Select options"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Page ----

export default function ShopSegmentPage() {
  // Params cover both route shapes:
  //   3-segment: /shop/:storeType/:storeName/:segment       (hub landing)
  //   4-segment: /shop/:storeType/:storeName/:channel/:collection  (collection view)
  const params = useParams<{
    storeType: string;
    storeName: string;
    segment?: string;
    channel?: string;
    collection?: string;
  }>();

  const storeType = params.storeType || "internal";
  const storeName = decodeURIComponent(params.storeName || "");

  // 4-segment route: channel + collection are explicit
  const channelParam = params.channel ? decodeURIComponent(params.channel) : undefined;
  const collectionParam = params.collection ? decodeURIComponent(params.collection) : undefined;

  // 3-segment route: segment is the channel slug (for internal stores)
  const segmentParam = params.segment ? decodeURIComponent(params.segment) : undefined;

  // Mode detection
  // - collectionMode: 4-segment URL — specific collection inside a channel
  // - hubMode: 3-segment URL on an internal store — channel landing with all products
  // - regularMode: generic store/segment browse
  const isCollectionMode = !!channelParam && !!collectionParam;
  const isHubMode = !isCollectionMode && storeType.toLowerCase() === "internal" && !!segmentParam;
  const isRegularMode = !isCollectionMode && !isHubMode;

  const currentChannel = channelParam ?? (isHubMode ? segmentParam : undefined);
  const currentCollection = collectionParam ?? undefined;

  // Build API URL
  const apiUrl = (() => {
    const base = `/api/store/${storeType}/${encodeURIComponent(storeName)}`;
    if (isCollectionMode) {
      return `${base}?channel=${encodeURIComponent(currentChannel!!)}&collection=${encodeURIComponent(currentCollection!!)}`;
    }
    if (isHubMode) {
      return `${base}?channel=${encodeURIComponent(currentChannel!!)}`;
    }
    if (segmentParam) {
      return `${base}?segment=${encodeURIComponent(segmentParam)}`;
    }
    return base;
  })();

  const { data, isLoading, error } = useQuery<StoreResponse>({
    queryKey: ["/api/store", storeType, storeName, currentChannel ?? null, currentCollection ?? null, segmentParam ?? null],
    queryFn: async () => {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("Failed to load store products");
      return res.json();
    },
    enabled: !!storeName,
  });

  // Count products per collection (used for hub tiles)
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.products || []).forEach((p) => {
      if (p.segment) counts[p.segment] = (counts[p.segment] || 0) + 1;
    });
    return counts;
  }, [data?.products]);

  // ---- Shared sub-renders ----

  const backHomeButton = (
    <Link href="/">
      <Button variant="ghost" className="mb-6" data-testid="button-back-home">
        <ArrowLeft className="mr-2 h-5 w-5" />
        Back to Home
      </Button>
    </Link>
  );

  const productGrid = (products: StoreProduct[]) =>
    products.length === 0 ? (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-12 text-center">
          <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground mb-2">No products available yet</p>
          <p className="text-sm text-muted-foreground">Check back soon for new QR Gear products!</p>
        </CardContent>
      </Card>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <StoreProductCard key={product.id} product={product} />
        ))}
      </div>
    );

  // ---- Loading / Error ----

  if (!storeName) {
    return (
      <StorefrontLayout>
        <div className="container max-w-6xl py-8 px-4 text-center py-16">
          <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-4">Please select a valid store to browse.</p>
          <Link href="/"><Button data-testid="button-go-home"><ArrowLeft className="mr-2 h-5 w-5" />Back to Home</Button></Link>
        </div>
      </StorefrontLayout>
    );
  }

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="container max-w-6xl py-8 px-4 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading products...</span>
        </div>
      </StorefrontLayout>
    );
  }

  if (error) {
    return (
      <StorefrontLayout>
        <div className="container max-w-6xl py-8 px-4 text-center py-16">
          <Store className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Error Loading Store</h1>
          <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
          <Link href="/"><Button data-testid="button-go-home-error"><ArrowLeft className="mr-2 h-5 w-5" />Back to Home</Button></Link>
        </div>
      </StorefrontLayout>
    );
  }

  // ---- Hub mode: channel landing (e.g. /shop/internal/qr-gear/usa250) ----

  if (isHubMode) {
    const channelDisplayName = data?.channelName || currentChannel || "";
    const hubPath = `/shop/${storeType}/${storeName}/${currentChannel}`;

    return (
      <StorefrontLayout>
        <div className="container max-w-6xl py-8 px-4">
          {backHomeButton}

          {/* Identity block */}
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              QR Gear
            </p>
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Flag className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-channel-title">
                {channelDisplayName.toUpperCase()}
              </h1>
            </div>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A tribute to the people, places, and principles that shaped America.
            </p>
          </div>

          {/* Collection tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
            {USA250_COLLECTIONS.map((col) => {
              const count = collectionCounts[col.id] || 0;
              return (
                <Link key={col.id} href={`${hubPath}/${col.id}`}>
                  <Card
                    className="hover-elevate cursor-pointer h-full"
                    data-testid={`card-collection-${col.id}`}
                  >
                    <CardContent className="p-5 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-base">{col.label}</h3>
                        {count > 0 && (
                          <Badge variant="secondary" data-testid={`badge-count-${col.id}`}>
                            {count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground flex-1">{col.description}</p>
                      <div className="flex items-center gap-1 text-xs text-primary mt-1">
                        Browse <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* All products */}
          {(data?.products.length ?? 0) > 0 && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground">All Products</h2>
                <p className="text-sm text-muted-foreground">Browse everything in this collection</p>
              </div>
              {productGrid(data!.products)}
            </>
          )}

          {(data?.products.length ?? 0) === 0 && (
            <Card className="max-w-md mx-auto">
              <CardContent className="py-12 text-center">
                <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground mb-2">Products coming soon</p>
                <p className="text-sm text-muted-foreground">
                  This collection is being stocked. Check back soon.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </StorefrontLayout>
    );
  }

  // ---- Collection mode: /shop/internal/qr-gear/usa250/monuments ----

  if (isCollectionMode) {
    const hubPath = `/shop/${storeType}/${storeName}/${currentChannel}`;
    const collectionLabel = getCollectionLabel(currentCollection!);

    return (
      <StorefrontLayout>
        <div className="container max-w-6xl py-8 px-4">
          <Link href={hubPath}>
            <Button variant="ghost" className="mb-6" data-testid="button-back-channel">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to USA 250
            </Button>
          </Link>

          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              QR Gear &rsaquo; USA 250
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-collection-title">
              {collectionLabel}
            </h1>
          </div>

          {productGrid(data?.products || [])}
        </div>
      </StorefrontLayout>
    );
  }

  // ---- Regular mode: generic store/segment view ----

  const displayTitle = segmentParam ? `${storeName} — ${segmentParam}` : storeName;

  return (
    <StorefrontLayout>
      <div className="container max-w-6xl py-8 px-4">
        {backHomeButton}

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">{displayTitle}</h1>
          </div>
          {segmentParam && (
            <p className="text-muted-foreground">
              Showing products in the &ldquo;{segmentParam}&rdquo; section
            </p>
          )}
        </div>

        {productGrid(data?.products || [])}
      </div>
    </StorefrontLayout>
  );
}
