import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";

export interface StoreLibraryItem {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  subtitle?: string;
  price?: number;
}

export interface StoreLibraryItemSkinProps {
  item: StoreLibraryItem;
  onOpen?: (item: StoreLibraryItem) => void;
  size?: "compact" | "standard";
}

export function StoreLibraryItemSkin({
  item,
  onOpen,
  size = "standard",
}: StoreLibraryItemSkinProps) {
  const isCompact = size === "compact";

  return (
    <Card
      className="overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onOpen?.(item)}
      data-testid={`store-library-item-${item.id}`}
    >
      <div className={`relative bg-muted flex items-center justify-center ${isCompact ? "h-24" : "h-36"}`}>
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="w-10 h-10 text-muted-foreground" />
        )}
      </div>

      <CardContent className={`${isCompact ? "p-1.5" : "p-2"} space-y-1`}>
        <p className={`font-medium text-foreground ${isCompact ? "text-[10px]" : "text-xs"} truncate`}>
          {item.title}
        </p>
        {item.subtitle && !isCompact && (
          <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
        )}
        {item.price != null && (
          <span className="text-xs font-bold text-emerald-500">${item.price.toFixed(2)}</span>
        )}
      </CardContent>
    </Card>
  );
}
