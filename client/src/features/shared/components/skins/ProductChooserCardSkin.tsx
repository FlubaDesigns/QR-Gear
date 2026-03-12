import { Badge } from "@/components/ui/badge";
import { Check, Package } from "lucide-react";

export interface ChooserProductItem {
  id: string | number;
  title: string;
  imageUrl: string | null;
  subtitle?: string;
  price?: number;
  badge?: string;
  metadata?: Record<string, string>;
}

export interface ProductChooserCardSkinProps {
  item: ChooserProductItem;
  isSelected: boolean;
  onSelect: (item: ChooserProductItem) => void;
  onOpen?: (item: ChooserProductItem) => void;
  size?: "compact" | "standard";
}

export function ProductChooserCardSkin({
  item,
  isSelected,
  onSelect,
  onOpen,
  size = "standard",
}: ProductChooserCardSkinProps) {
  const isCompact = size === "compact";

  return (
    <button
      onClick={() => onSelect(item)}
      className={`w-full flex items-center gap-3 ${isCompact ? "p-1.5" : "p-2"} rounded-xl border-2 transition-all text-left ${
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:border-muted-foreground/40"
      }`}
      data-testid={`chooser-product-${item.id}`}
    >
      <div
        className={`${isCompact ? "w-10 h-10" : "w-14 h-14"} rounded-lg bg-white flex items-center justify-center flex-shrink-0 overflow-hidden`}
        onClick={(e) => {
          if (onOpen) {
            e.stopPropagation();
            onOpen(item);
          }
        }}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <Package className={`${isCompact ? "w-5 h-5" : "w-7 h-7"} text-muted-foreground`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`font-medium text-foreground ${isCompact ? "text-xs" : "text-sm"} truncate`}>{item.title}</p>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {item.price != null && (
            <span className={`font-bold text-emerald-500 ${isCompact ? "text-xs" : "text-sm"}`}>
              ${item.price.toFixed(2)}
            </span>
          )}
          {item.badge && (
            <Badge variant="secondary" className="text-[10px]">{item.badge}</Badge>
          )}
        </div>
      </div>

      {isSelected && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
    </button>
  );
}
