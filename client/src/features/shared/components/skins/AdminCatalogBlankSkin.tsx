import { Badge } from "@/components/ui/badge";
import { X, Package } from "lucide-react";

export interface CatalogBlankItem {
  id: string;
  catalogKey: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string | null;
  tier?: "good" | "better" | "best" | null;
  isPrintful?: boolean;
  hasMockupMapping?: boolean;
  qrgBlankId?: number | null;
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
      className="flex-shrink-0 w-24 relative rounded-md overflow-hidden border bg-muted"
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

      <div className="px-1 py-1 bg-muted/80">
        <p className="text-[10px] text-foreground truncate leading-tight">{item.title}</p>
        {item.subtitle && (
          <p className="text-[9px] text-muted-foreground truncate leading-tight">{item.subtitle}</p>
        )}
        {item.qrgBlankId != null && (
          <p className="text-[8px] text-muted-foreground/60 font-mono truncate leading-tight">QRG-{item.qrgBlankId}</p>
        )}
      </div>

      {item.tier && (
        <Badge className={`absolute top-1 left-1 text-[9px] px-1 py-0 ${TIER_COLORS[item.tier] || ""}`}>
          {item.tier}
        </Badge>
      )}

      {item.isPrintful && (
        <Badge className="absolute top-1 right-7 text-[9px] px-1 py-0 bg-purple-600 text-white">
          PF
        </Badge>
      )}

      {onRemove && (
        <button
          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-sm h-6 w-6 flex items-center justify-center transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.catalogKey);
          }}
          disabled={removing}
          data-testid={`button-remove-catalog-blank-${item.catalogKey}`}
          aria-label={`Remove ${item.title}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
