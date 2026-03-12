import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

export interface StoreProductItem {
  id: string | number;
  title: string;
  imageUrl: string | null;
  retailPrice?: number;
  description?: string;
  colorCount?: number;
  madeInUSA?: boolean;
  badge?: string;
}

export interface StoreProductCardSkinProps {
  item: StoreProductItem;
  onOpen?: (item: StoreProductItem) => void;
  size?: "compact" | "standard" | "expanded";
}

export function StoreProductCardSkin({
  item,
  onOpen,
  size = "standard",
}: StoreProductCardSkinProps) {
  const isCompact = size === "compact";

  return (
    <Card
      className="overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onOpen?.(item)}
      data-testid={`store-product-card-${item.id}`}
    >
      <div className={`relative bg-white flex items-center justify-center ${isCompact ? "h-32" : "h-48"}`}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <Package className="w-12 h-12 text-muted-foreground" />
        )}

        {item.madeInUSA && (
          <Badge className="absolute top-2 left-2 text-[10px] bg-blue-600 text-white">
            USA
          </Badge>
        )}

        {item.badge && (
          <Badge className="absolute top-2 right-2 text-[10px] bg-orange-500 text-white">
            {item.badge}
          </Badge>
        )}
      </div>

      <CardContent className={`${isCompact ? "p-2" : "p-3"} space-y-1`}>
        <p className={`font-medium text-foreground ${isCompact ? "text-xs" : "text-sm"} line-clamp-2`}>
          {item.title}
        </p>

        {item.description && !isCompact && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {item.retailPrice != null && (
            <span className={`font-bold text-emerald-500 ${isCompact ? "text-sm" : "text-lg"}`}>
              ${item.retailPrice.toFixed(2)}
            </span>
          )}
          {item.colorCount != null && item.colorCount > 0 && (
            <span className="text-[10px] text-muted-foreground">{item.colorCount} colors</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
