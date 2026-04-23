import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, ArrowLeft, ShoppingCart, Check, QrCode, Package, Minus, Plus,
} from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";
import SEO from "@/components/SEO";
import ProductImageGallery from "@/components/ProductImageGallery";
import { buildProductGallery } from "@/features/storefront-shared/buildProductGallery";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const QR_PRODUCT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "qr-basics": { label: "QR Basics", color: "bg-slate-500" },
  "qr-plus": { label: "QR Plus", color: "bg-blue-500" },
  "qr-canvas": { label: "QR Canvas", color: "bg-purple-500" },
  "qr-play": { label: "QR Play", color: "bg-rose-500" },
  "qr-dynamics": { label: "QR Dynamics", color: "bg-emerald-500" },
};

const COLOR_HEX_MAP: Record<string, string> = {
  // Whites / Creams / Naturals
  "White": "#FFFFFF", "Solid White Blend": "#F2F2F0", "Vintage White": "#F0EBD8",
  "Soft Cream": "#F5EDD8", "Natural": "#F5F5DC", "Heather Natural": "#D8CCA0",
  "Sand": "#C2B280", "Heather Sand Dune": "#C8B89A", "Pebble": "#B8A890",
  "Heather Dust": "#BBAB88", "Tan": "#C8A878", "Toast": "#B88B5B",
  // Blacks / Very Dark
  "Black": "#000000", "Vintage Black": "#2B2828", "Oxblood Black": "#3F0E12",
  "Black Heather": "#3A3A3A", "Dark Heather": "#374151", "Charcoal": "#36454F",
  "Asphalt": "#484848",
  // Greys
  "Ash": "#B2BEB5", "Silver": "#C0C0C0", "Heather Gray": "#B2B2B2",
  "Heather Grey": "#B2B2B2", "Athletic Heather": "#C0BCB8", "Sport Gray": "#9CA3AF",
  "Sport Grey": "#9CA3AF", "Heather Cool Grey": "#A8A8A8", "Dark Grey": "#606060",
  "Dark Grey Heather": "#646464", "Heather Slate": "#7B8B9B",
  // Navy / Dark Blues
  "Navy": "#1F2E5C", "Navy Blue": "#1F2E5C", "Heather Navy": "#2D3A5E",
  "Heather Midnight Navy": "#1A2440",
  // Blues
  "Royal Blue": "#4169E1", "True Royal": "#2B5BA8", "Heather True Royal": "#4470A8",
  "Sapphire": "#0F52BA", "Ocean Blue": "#2A6EA6", "Steel Blue": "#4682B4",
  "Heather Columbia Blue": "#8AAECB", "Heather Carolina Blue": "#7AA4C0",
  "Light Blue": "#ADD8E6", "Baby Blue": "#89CFF0", "Heather Ice Blue": "#B8D4E8",
  "Heather Prism Ice Blue": "#B0C8D8", "Heather Prism Dusty Blue": "#8AAAB8",
  // Teals / Aquas
  "Teal": "#007B7B", "Heather Deep Teal": "#2B6B6B", "Aqua": "#00B4B4",
  "Heather Aqua": "#5CC0C0", "Turquoise": "#40E0D0",
  // Greens / Mints
  "Mint": "#A8DDB8", "Heather Mint": "#8BC0A0", "Heather Prism Mint": "#A0C8B8",
  "Sage": "#8B9B7B", "Leaf": "#6B8B5B", "Heather Grass Green": "#6B9B5B",
  "Heather Emerald": "#2B7B4B", "Kelly": "#4CBB17", "Kelly Green": "#4CBB17",
  "Heather Kelly": "#5B9B5B", "Olive": "#6B6D3B", "Heather Olive": "#7B8B5B",
  "Military Green": "#6B6B4A", "Army": "#454B3B", "Forest": "#2D5A27",
  "Forest Green": "#228B22", "Heather Forest": "#4A6B3B",
  // Yellows / Golds / Oranges
  "Yellow": "#FFFF00", "Daisy": "#F7D070", "Gold": "#FFD700",
  "Mustard": "#C8A030", "Heather Yellow Gold": "#D8B838", "Autumn": "#C87B3B",
  "Heather Autumn": "#C08B6B", "Orange": "#E86010", "Burnt Orange": "#CC5500",
  "Tennessee Orange": "#FF6200", "Heather Orange": "#D88B5B",
  // Reds
  "Red": "#CC2529", "Heather Red": "#B04455", "Cardinal": "#8B1A2A",
  "Maroon": "#800000", "Berry": "#6B2842", "Heather Raspberry": "#9B3B5B",
  // Pinks
  "Pink": "#F4A7B9", "Soft Pink": "#F0B0B8", "Charity Pink": "#E87B9B",
  "Heather Clay": "#B87B6B", "Heather Prism Peach": "#D8A890",
  "Heather Mauve": "#B08890", "Mauve": "#A07575",
  // Purples / Lavenders
  "Purple": "#6B3FA0", "Lilac": "#C8A8D0", "Heather Prism Lilac": "#C0A8C8",
  "Team Purple": "#4A3575", "Heather Team Purple": "#6B5E8B",
  "Heather Orchid": "#9B7BC0",
  // Browns
  "Brown": "#7B4B2B", "Heather Brown": "#8B6B4B",
};

function getColorHex(colorName: string): string {
  return COLOR_HEX_MAP[colorName] || "#CCCCCC";
}

function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  // Standard relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

interface ProductOptionValue {
  label: string;
  hex?: string;
  available: boolean;
}

interface ProductOption {
  name: string;
  displayType: 'swatches' | 'pills' | 'dropdown';
  isPrimary: boolean;
  values: ProductOptionValue[];
}

interface StoreProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  productLine: string;
  imageUrl: string | null;
  /** Full ordered gallery array from API — primary image source. First item is hero/mockup. */
  images?: string[] | null;
  packetImageUrl?: string | null;
  qrCodeUrl: string | null;
  qrProductType: string;
  price: number | null;
  availableSizes: string[];
  availableColors: string[];
  availablePlacements: string[];
  defaultColor: string | null;
  mockupsByColor: Record<string, { front?: string; lifestyle?: string; angles?: string[] }> | null;
  selectedGraphicSize: string | null;
  storeId: string | null;
  storeName: string | null;
  channel: string | null;
  collection: string | null;
  packetId: string | null;
  /** Structured display-intent options from builder layer */
  options?: ProductOption[] | null;
  /** Card display mode */
  cardMode?: 'browseOnly' | 'quickAdd' | null;
}

export default function ShopProductPage() {
  const [match, params] = useRoute("/shop/product/:linkId");
  const linkId = params?.linkId;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const { data: product, isLoading, error } = useQuery<StoreProduct>({
    queryKey: ["/api/store/product", linkId],
    queryFn: async () => {
      const res = await fetch(`/api/store/product/${linkId}`);
      if (!res.ok) throw new Error("Product not found");
      return res.json();
    },
    enabled: !!linkId,
  });

  if (product && !selectedColor && product.defaultColor) {
    setSelectedColor(product.defaultColor);
  }
  if (product && !selectedSize && product.availableSizes?.length > 0) {
    setSelectedSize(product.availableSizes[0]);
  }

  const galleryImages = useMemo(
    () => buildProductGallery(product ?? null, selectedColor),
    [product, selectedColor],
  );

  const displayImage = galleryImages[0]?.url || product?.imageUrl;

  const handleAddToCart = async (): Promise<boolean> => {
    if (!product || !product.price) return false;
    setAddingToCart(true);

    try {
      const addToCartRes = await fetch(`/api/store/product/${linkId}/add-to-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedColor, selectedSize, quantity }),
      });
      if (!addToCartRes.ok) {
        const err = await addToCartRes.json().catch(() => ({ error: "Failed to add to cart" }));
        throw new Error(err.error || "Failed to add to cart");
      }
      const resolved = await addToCartRes.json();

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
          packetId: product.packetId,
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
        description: `${product.name} has been added to your cart.`,
      });
      return true;
    } catch (err: any) {
      toast({
        title: "Failed to add to cart",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setAddingToCart(false);
    }
  };

  if (!match || !linkId) {
    return (
      <StorefrontLayout>
        <div className="container max-w-4xl py-16 px-4 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <Link href="/"><Button data-testid="button-go-home"><ArrowLeft className="mr-2 h-4 w-4" />Back to Home</Button></Link>
        </div>
      </StorefrontLayout>
    );
  }

  if (isLoading) {
    return (
      <StorefrontLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading product...</span>
        </div>
      </StorefrontLayout>
    );
  }

  if (error || !product) {
    return (
      <StorefrontLayout>
        <div className="container max-w-4xl py-16 px-4 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-muted-foreground mb-4">{(error as Error)?.message || "This product could not be loaded."}</p>
          <Link href="/"><Button data-testid="button-go-home-error"><ArrowLeft className="mr-2 h-4 w-4" />Back to Home</Button></Link>
        </div>
      </StorefrontLayout>
    );
  }

  const typeInfo = QR_PRODUCT_TYPE_LABELS[product.qrProductType];

  return (
    <StorefrontLayout>
      <SEO
        title={`${product.name} | QR Gear`}
        description={product.description || `Custom QR merchandise - ${product.name}`}
      />
      <div className="container max-w-6xl py-6 px-4">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => window.history.back()}
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Card className="overflow-hidden">
              <div className="aspect-square relative bg-muted">
                {galleryImages.length > 0 ? (
                  <ProductImageGallery images={galleryImages} />
                ) : displayImage ? (
                  <ProductImageGallery images={[{ url: displayImage, alt: product.name }]} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <QrCode className="h-24 w-24 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {typeInfo && (
                  <Badge className={`text-white ${typeInfo.color}`} data-testid="badge-product-type">
                    {typeInfo.label}
                  </Badge>
                )}
                {product.category && (
                  <Badge variant="outline" data-testid="badge-category">{product.category}</Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-product-name">
                {product.name}
              </h1>
              {product.description && (
                <p className="text-muted-foreground mt-2" data-testid="text-product-description">
                  {product.description}
                </p>
              )}
            </div>

            <div>
              {product.price !== null ? (
                <p className="text-3xl font-bold text-foreground" data-testid="text-product-price">
                  ${product.price.toFixed(2)}
                </p>
              ) : (
                <p className="text-lg text-muted-foreground" data-testid="text-price-unavailable">
                  Price not yet set
                </p>
              )}
            </div>

            <Separator />

            {(() => {
              const colorOption = product.options?.find(o => o.name === 'color');
              const colorValues = colorOption
                ? colorOption.values
                : product.availableColors.map(label => ({ label, hex: getColorHex(label), available: true }));
              if (colorValues.length === 0) return null;
              return (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Color:{" "}
                    <span className="text-muted-foreground font-normal">
                      {selectedColor || "Select a color"}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {colorValues.map((cv) => {
                      const hex = cv.hex || getColorHex(cv.label);
                      const isSelected = selectedColor === cv.label;
                      const isLight = isLightColor(hex);
                      return (
                        <button
                          key={cv.label}
                          className={`w-11 h-11 rounded-full border-2 transition-all relative flex-shrink-0 ${
                            !cv.available
                              ? "opacity-40 cursor-not-allowed"
                              : isSelected
                              ? "border-primary ring-2 ring-primary/30 scale-110"
                              : "border-border hover:scale-105"
                          }`}
                          style={{ backgroundColor: hex }}
                          onClick={() => cv.available && setSelectedColor(cv.label)}
                          title={cv.label}
                          aria-label={cv.label}
                          aria-pressed={isSelected}
                          aria-disabled={!cv.available}
                          data-testid={`swatch-${cv.label.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {isSelected && cv.available && (
                            <Check
                              className={`h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
                                isLight ? "text-black" : "text-white"
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const sizeOption = product.options?.find(o => o.name === 'size');
              const sizeValues = sizeOption
                ? sizeOption.values
                : product.availableSizes.map(label => ({ label, available: true }));
              if (sizeValues.length === 0) return null;
              return (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Size: {selectedSize || "Select a size"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sizeValues.map((sv) => {
                      const isSelected = selectedSize === sv.label;
                      return (
                        <Button
                          key={sv.label}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          disabled={!sv.available}
                          onClick={() => sv.available && setSelectedSize(sv.label)}
                          data-testid={`button-size-${sv.label.toLowerCase()}`}
                        >
                          {sv.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="text-sm font-medium mb-2 block">Quantity</label>
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  data-testid="button-quantity-decrease"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-lg font-medium w-8 text-center" data-testid="text-quantity">
                  {quantity}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity(quantity + 1)}
                  data-testid="button-quantity-increase"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                disabled={!product.price || addingToCart}
                onClick={handleAddToCart}
                data-testid="button-add-to-cart"
              >
                {addingToCart ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <ShoppingCart className="h-5 w-5 mr-2" />
                )}
                {product.price
                  ? `Add to Cart — $${(product.price * quantity).toFixed(2)}`
                  : "Price Not Available"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                size="lg"
                disabled={!product.price || addingToCart}
                onClick={async () => {
                  const success = await handleAddToCart();
                  if (success) setLocation("/cart");
                }}
                data-testid="button-buy-now"
              >
                Buy Now
              </Button>
            </div>

            {product.storeName && (
              <p className="text-xs text-muted-foreground text-center">
                Sold by {product.storeName}
              </p>
            )}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
