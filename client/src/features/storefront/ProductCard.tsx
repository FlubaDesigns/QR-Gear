import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Star, Sparkles, QrCode, ShoppingCart } from "lucide-react";
import ProductImageGallery from "@/components/ProductImageGallery";
import { buildProductGallery } from "@/features/storefront-shared/buildProductGallery";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StoreProduct } from "./types";

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

export const QR_PRODUCT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "qr-basics": { label: "QR Basics", color: "bg-slate-500" },
  "qr-plus": { label: "QR Plus", color: "bg-blue-500" },
  "qr-canvas": { label: "QR Canvas", color: "bg-purple-500" },
  "qr-play": { label: "QR Play", color: "bg-rose-500" },
  "qr-dynamics": { label: "QR Dynamics™", color: "bg-emerald-500" },
};

export function StoreProductCard({ product }: { product: StoreProduct }) {
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

  const galleryImages = useMemo(
    () => buildProductGallery(product, selectedColor),
    [product, selectedColor],
  );

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
