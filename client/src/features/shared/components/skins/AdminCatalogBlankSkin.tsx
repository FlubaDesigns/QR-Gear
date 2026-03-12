import { Badge } from "@/components/ui/badge";
import { X, Package } from "lucide-react";

export interface CatalogBlankItem {
  id: string;
  catalogKey: string;
  title: string;
  imageUrl: string | null;
  tier?: "good" | "better" | "best" | null;
  isPrintful?: boolean;
  hasMockupMapping?: boolean;
}

export interface AdminCatalogBlankSkinProps {
  item: CatalogBlankItem;
  onRemove?: (catalogKey: string) => void;
  removing?: boolean;
}

const TIER_COLORS: Record<string, string> = {
  good: "bg-blue-600 text-white",
  better: "bg-amber-500 text-white",
  best: "bg-emerald-600 text-white",
};

export function AdminCatalogBlankSkin({ item, onRemove, removing }: AdminCatalogBlankSkinProps) {
  return (
    <div
      className="flex-shrink-0 w-32 relative group rounded-md overflow-hidden border bg-muted"
      data-testid={`catalog-blank-${item.catalogKey}`}
    >
      <div className="aspect-square flex items-center justify-center p-1">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <Package className="w-8 h-8 text-muted-foreground" />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
        <p className="text-[10px] text-white truncate">{item.title}</p>
      </div>

      {item.tier && (
        <Badge
          className={`absolute top-1 left-1 text-[9px] px-1 py-0 ${TIER_COLORS[item.tier] || ""}`}
        >
          {item.tier}
        </Badge>
      )}

      {item.isPrintful && (
        <Badge className="absolute bottom-5 left-1 text-[9px] px-1 py-0 bg-purple-600 text-white">
          PF
        </Badge>
      )}

      {item.hasMockupMapping && (
        <Badge className="absolute bottom-5 right-1 text-[9px] px-1 py-0 bg-violet-600 text-white">
          M
        </Badge>
      )}

      {onRemove && (
        <button
          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.catalogKey);
          }}
          disabled={removing}
          data-testid={`button-remove-catalog-blank-${item.catalogKey}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
