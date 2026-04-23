import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Star, Sparkles, ScanLine } from "lucide-react";
import type { StoreProduct } from "./types";

export const QR_PRODUCT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "qr-basics": { label: "QR Basics", color: "bg-slate-500" },
  "qr-plus": { label: "QR Plus", color: "bg-blue-500" },
  "qr-canvas": { label: "QR Canvas", color: "bg-purple-500" },
  "qr-play": { label: "QR Play", color: "bg-rose-500" },
  "qr-dynamics": { label: "QR Dynamics™", color: "bg-emerald-500" },
};

export function StoreProductCard({ product }: { product: StoreProduct }) {
  const href = `/shop/product/${product.id}`;
  const heroImage = (product as any).images?.[0] ?? product.imageUrl;
  const typeInfo = product.qrProductType ? QR_PRODUCT_TYPE_LABELS[product.qrProductType] : null;

  return (
    <Link href={href}>
      <Card
        className="h-full flex flex-col cursor-pointer hover-elevate group"
        data-testid={`card-product-${product.id}`}
      >
        <div className="aspect-square relative bg-muted overflow-hidden">
          {heroImage ? (
            <img
              src={heroImage}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              data-testid={`img-product-${product.id}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <QrCode className="h-14 w-14 text-muted-foreground/40" />
            </div>
          )}

          {(product.isFeatured || product.isSeasonalPromo) && (
            <div className="absolute top-2 left-2 flex gap-1">
              {product.isFeatured && (
                <Badge variant="default" className="gap-1 text-xs">
                  <Star className="h-3 w-3" /> Featured
                </Badge>
              )}
              {product.isSeasonalPromo && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" /> Promo
                </Badge>
              )}
            </div>
          )}
        </div>

        <CardContent className="flex-1 p-3 flex flex-col gap-1.5">
          <div className="flex-1">
            <h3
              className="font-semibold text-base leading-snug line-clamp-2"
              data-testid={`text-product-name-${product.id}`}
            >
              {product.name}
            </h3>

            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <ScanLine className="h-3 w-3 flex-shrink-0" />
              Wear + Scan experience
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {product.price != null && product.price > 0 && (
                <span
                  className="text-xl font-bold text-emerald-500"
                  data-testid={`text-price-${product.id}`}
                >
                  ${product.price.toFixed(2)}
                </span>
              )}
              {typeInfo && (
                <Badge
                  className={`text-xs text-white ${typeInfo.color}`}
                  data-testid={`badge-product-type-${product.id}`}
                >
                  {typeInfo.label}
                </Badge>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </Link>
  );
}
