import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, ArrowLeft, ShoppingCart, Check, QrCode, Package, Minus, Plus,
  ScanLine, Shield, Truck,
} from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";
import SEO from "@/components/SEO";
import ProductImageGallery from "@/components/ProductImageGallery";
import { buildProductGallery } from "@/features/storefront-shared/buildProductGallery";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getColorHexByName } from "@/features/storeBuilder/store-builder-types";
import { StorefrontBreadcrumb } from "@/features/storefront/StorefrontBreadcrumb";
import { getChannelConfig } from "@/data/shopHierarchy";
import PhoneMockupCard from "@/components/PhoneMockupCard";

const QR_PRODUCT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "qr-basics": { label: "QR Basics", color: "bg-slate-500" },
  "qr-plus": { label: "QR Plus", color: "bg-blue-500" },
  "qr-canvas": { label: "QR Canvas", color: "bg-purple-500" },
  "qr-play": { label: "QR Play", color: "bg-rose-500" },
  "qr-dynamics": { label: "QR Dynamics", color: "bg-emerald-500" },
};

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
  /** The built graphic+QR composite image — shown as the "destination" preview */
  compositeUrl?: string | null;
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
  /** Screenshot/preview of the linked digital experience — shown as "Where it takes you" */
  landingPageSnapshotUrl?: string | null;
  /** Autoplaying video URL — QR Play products only */
  playMediaUrl?: string | null;
  /** Cycling images for destination preview — QR Compose products only */
  composeImages?: string[] | null;
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
  const [mockupFetching, setMockupFetching] = useState(false);
  // Local mockup cache — starts from API data, enriched on-demand as colors are picked
  const [localMockupsByColor, setLocalMockupsByColor] = useState<
    Record<string, { front?: string; lifestyle?: string; angles?: string[] }> | null
  >(null);

  const { data: product, isLoading, error } = useQuery<StoreProduct>({
    queryKey: ["/api/store/product", linkId],
    queryFn: async () => {
      const res = await fetch(`/api/store/product/${linkId}`);
      if (!res.ok) throw new Error("Product not found");
      return res.json();
    },
    enabled: !!linkId,
  });

  // Initialise selection once per product load — use options[] contract first, fallback to raw fields
  useEffect(() => {
    if (!product) return;
    // Seed local mockup cache from API data
    setLocalMockupsByColor(product.mockupsByColor ?? null);

    const colorOpt = product.options?.find(o => o.name === 'color');
    const defaultColor =
      colorOpt?.values.find(v => v.available)?.label ??
      product.defaultColor ??
      null;
    if (defaultColor) setSelectedColor(defaultColor);

    const sizeOpt = product.options?.find(o => o.name === 'size');
    const defaultSize =
      sizeOpt?.values.find(v => v.available)?.label ??
      product.availableSizes?.[0] ??
      null;
    if (defaultSize) setSelectedSize(defaultSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Normalize color name the same way buildProductGallery does
  const normalizeColorKey = (s: string) =>
    s.replace(/^(Solid|Heather)\s+/i, '').toLowerCase().trim().replace(/\s+/g, '-');

  // Returns true if the color already has a mockup in the local cache
  const isMockupCached = (color: string): boolean => {
    if (!localMockupsByColor) return false;
    const target = normalizeColorKey(color);
    return Object.keys(localMockupsByColor).some(
      (key) => normalizeColorKey(key.split('_')[0]) === target,
    );
  };

  const handleColorChange = async (color: string) => {
    setSelectedColor(color);
    if (!linkId || isMockupCached(color)) return;
    setMockupFetching(true);
    try {
      const res = await fetch(`/api/store/product/${linkId}/mockup-for-color`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorName: color }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.mockupUrl) {
          setLocalMockupsByColor((prev) => ({
            ...(prev ?? {}),
            [color]: {
              front: data.mockupUrl,
              ...(data.lifestyleMockupUrl ? { lifestyle: data.lifestyleMockupUrl } : {}),
            },
          }));
        }
      }
    } catch {
      // Silent — gallery will fall back to generic images
    } finally {
      setMockupFetching(false);
    }
  };

  // Build gallery using local (enriched) mockup cache so color swaps are instant when cached
  const galleryImages = useMemo(
    () => buildProductGallery(
      product ? { ...product, mockupsByColor: localMockupsByColor } : null,
      selectedColor,
    ),
    [product, selectedColor, localMockupsByColor],
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
          packetId: resolved.customization?.packetId || product.packetId,
          printifyProductId: resolved.customization?.printifyProductId || null,
          printifyVariantId: resolved.customization?.printifyVariantId || null,
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

  // Build fallback options from raw arrays when structured options[] are absent
  const colorOption = product.options?.find(o => o.name === 'color') ??
    (product.availableColors?.length
      ? {
          name: 'color',
          displayType: 'swatches' as const,
          isPrimary: true,
          values: product.availableColors.map(c => ({ label: c, available: true, hex: undefined })),
        }
      : null);

  const sizeOption = product.options?.find(o => o.name === 'size') ??
    (product.availableSizes?.length
      ? {
          name: 'size',
          displayType: 'pills' as const,
          isPrimary: false,
          values: product.availableSizes.map(s => ({ label: s, available: true })),
        }
      : null);

  // Build breadcrumb crumbs from product channel/collection data
  const breadcrumbs = (() => {
    const crumbs: Array<{ label: string; href?: string }> = [
      { label: "QR Gear", href: "/shop/internal/qrgear" },
    ];
    if (product.channel) {
      const channelCfg = getChannelConfig("qrgear", product.channel);
      if (channelCfg) {
        crumbs.push({ label: channelCfg.label, href: `/shop/internal/qrgear/${product.channel}` });
        if (product.collection) {
          const collCfg = channelCfg.collections.find(
            (c) => c.segmentValue === product.collection || c.label === product.collection
          );
          if (collCfg) {
            crumbs.push({
              label: collCfg.label,
              href: `/shop/internal/qrgear/${product.channel}/${collCfg.slug}`,
            });
          }
        }
      }
    }
    crumbs.push({ label: product.name });
    return crumbs;
  })();

  return (
    <StorefrontLayout>
      <SEO
        title={`${product.name} | QR Gear`}
        description={product.description || `Custom QR merchandise - ${product.name}`}
      />
      <div className="container max-w-6xl py-6 px-4">
        <StorefrontBreadcrumb crumbs={breadcrumbs} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            {/* overflow-hidden clips image to Card radius; no aspect-square wrapper so dots + thumbnails show below */}
            <Card className="overflow-hidden relative">
              {mockupFetching && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Loading color mockup…</span>
                </div>
              )}
              {galleryImages.length > 0 ? (
                <ProductImageGallery images={galleryImages} />
              ) : displayImage ? (
                <ProductImageGallery images={[{ url: displayImage, alt: product.name }]} />
              ) : (
                <div className="aspect-square flex items-center justify-center bg-muted rounded-md">
                  <QrCode className="h-24 w-24 text-muted-foreground/50" />
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            {/* ── Title block ───────────────────────────────────────────── */}
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
              <p className="text-base font-semibold text-foreground mt-2">
                Scan it. It opens something real.
              </p>
            </div>

            {/* ── What You're Holding ───────────────────────────────────── */}
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                What You're Holding
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                This isn't just a design printed on fabric.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Every piece is a gateway. Scan the code and it opens a living digital experience tied to what you're wearing.
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <ScanLine className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                No app. Just scan.
              </p>
            </div>

            {/* ── Phone Mockup Experience Card ──────────────────────────── */}
            <PhoneMockupCard
              qrCodeUrl={product.qrCodeUrl}
              landingPageSnapshotUrl={product.landingPageSnapshotUrl}
              playMediaUrl={product.playMediaUrl}
              composeImages={product.composeImages}
              qrProductType={product.qrProductType}
              productName={product.name}
              data-testid="card-phone-mockup"
            />

            {/* ── Physical layer ────────────────────────────────────────── */}
            {product.description && (
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-product-description">
                {product.description}
              </p>
            )}

            {/* ── Price + benefit bullets ───────────────────────────────── */}
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

              <ul className="mt-3 space-y-1.5" data-testid="list-product-benefits">
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  Made to order in the USA
                </li>
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  Premium print quality
                </li>
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  Yours alone — not sold in stores
                </li>
              </ul>
            </div>

            <Separator />

            {(() => {
              if (!colorOption || colorOption.values.length === 0) return null;
              return (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Color
                  </label>
                  <Select
                    value={selectedColor ?? ''}
                    onValueChange={(val) => handleColorChange(val)}
                    data-testid="select-color"
                  >
                    <SelectTrigger className="w-full">
                      {selectedColor ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                            style={{ backgroundColor: colorOption.values.find(cv => cv.label === selectedColor)?.hex || getColorHexByName(selectedColor) || '#ccc' }}
                          />
                          {selectedColor}
                        </span>
                      ) : (
                        <SelectValue placeholder="Select a color" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {colorOption.values.map(cv => {
                        const hex = cv.hex || getColorHexByName(cv.label) || '#ccc';
                        return (
                          <SelectItem
                            key={cv.label}
                            value={cv.label}
                            disabled={!cv.available}
                            data-testid={`option-color-${cv.label.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                                style={{ backgroundColor: hex }}
                              />
                              <span className={!cv.available ? 'opacity-40' : ''}>
                                {cv.label}
                              </span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}

            {(() => {
              if (!sizeOption || sizeOption.values.length === 0) return null;
              const displayType = sizeOption.displayType ?? 'pills';
              return (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Size:{" "}
                    <span className="text-muted-foreground font-normal">
                      {selectedSize || "Select a size"}
                    </span>
                  </label>
                  {displayType === 'pills' && (
                    <div className="flex flex-wrap gap-2">
                      {sizeOption.values.map((sv) => (
                        <Button
                          key={sv.label}
                          variant={selectedSize === sv.label ? "default" : "outline"}
                          size="sm"
                          disabled={!sv.available}
                          onClick={() => sv.available && setSelectedSize(sv.label)}
                          data-testid={`button-size-${sv.label.toLowerCase()}`}
                        >
                          {sv.label}
                        </Button>
                      ))}
                    </div>
                  )}
                  {displayType === 'swatches' && (
                    <div className="flex flex-wrap gap-2.5">
                      {sizeOption.values.map((sv) => {
                        const isSelected = selectedSize === sv.label;
                        return (
                          <button
                            key={sv.label}
                            className={`w-11 h-11 rounded-full border-2 transition-all flex-shrink-0 flex items-center justify-center ${
                              !sv.available
                                ? "opacity-40 cursor-not-allowed"
                                : isSelected
                                ? "border-primary ring-2 ring-primary/30 scale-110 bg-primary text-primary-foreground"
                                : "border-border hover:scale-105"
                            }`}
                            onClick={() => sv.available && setSelectedSize(sv.label)}
                            aria-label={sv.label}
                            data-testid={`swatch-size-${sv.label.toLowerCase()}`}
                          >
                            <span className="text-xs font-medium">{sv.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {displayType === 'dropdown' && (
                    <select
                      className="w-full border rounded-md p-2 text-sm bg-background"
                      value={selectedSize ?? ''}
                      onChange={e => setSelectedSize(e.target.value)}
                      data-testid="select-size"
                    >
                      <option value="">Select a size</option>
                      {sizeOption.values.map(sv => (
                        <option key={sv.label} value={sv.label} disabled={!sv.available}>
                          {sv.label}
                        </option>
                      ))}
                    </select>
                  )}
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
              <p className="text-xs text-muted-foreground text-center">
                You're buying access, not just fabric.
              </p>

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

              {/* Trust strip */}
              <div className="flex items-center justify-center gap-4 pt-1 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" /> Secure checkout
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Truck className="h-3 w-3" /> Made to order
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="h-3 w-3" /> Ships from the USA
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
