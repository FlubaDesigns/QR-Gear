import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Pencil, Trash2, ExternalLink } from "lucide-react";

export interface PacketItem {
  id: string;
  title: string;
  imageUrl: string | null;
  status?: string;
  selectedColor?: string;
  selectedSize?: string;
  productTitle?: string;
  retailPrice?: number;
  earnings?: number;
  packetType?: string;
}

export interface PacketItemSkinProps {
  item: PacketItem;
  onOpen?: (item: PacketItem) => void;
  onEdit?: (item: PacketItem) => void;
  onRemove?: (item: PacketItem) => void;
  onShare?: (item: PacketItem) => void;
  size?: "compact" | "standard" | "expanded";
}

const STATUS_COLORS: Record<string, string> = {
  published: "bg-green-600 text-white",
  draft: "bg-amber-500 text-white",
  building: "bg-blue-500 text-white",
  archived: "bg-slate-500 text-white",
};

export function PacketItemSkin({
  item,
  onOpen,
  onEdit,
  onRemove,
  onShare,
  size = "standard",
}: PacketItemSkinProps) {
  const isCompact = size === "compact";
  const isExpanded = size === "expanded";

  if (isCompact) {
    return (
      <button
        onClick={() => onOpen?.(item)}
        className="w-full flex items-center gap-2 p-1.5 rounded-lg border bg-card hover-elevate transition-all text-left"
        data-testid={`packet-item-${item.id}`}
      >
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Package className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
          {item.productTitle && <p className="text-[10px] text-muted-foreground truncate">{item.productTitle}</p>}
        </div>
        {item.status && (
          <Badge className={`text-[9px] px-1 py-0 ${STATUS_COLORS[item.status] || ""}`}>{item.status}</Badge>
        )}
      </button>
    );
  }

  return (
    <Card
      className="overflow-hidden hover-elevate transition-all"
      data-testid={`packet-item-${item.id}`}
    >
      <div
        className={`relative bg-muted flex items-center justify-center cursor-pointer ${isExpanded ? "h-52" : "h-36"}`}
        onClick={() => onOpen?.(item)}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Package className="w-12 h-12 text-muted-foreground" />
        )}

        {item.status && (
          <Badge className={`absolute top-2 right-2 text-[10px] ${STATUS_COLORS[item.status] || ""}`}>
            {item.status}
          </Badge>
        )}

        {item.packetType && (
          <Badge className="absolute top-2 left-2 text-[10px] bg-slate-700 text-white">
            {item.packetType}
          </Badge>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>

        {item.productTitle && (
          <p className="text-xs text-muted-foreground truncate">{item.productTitle}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {item.selectedColor && (
            <Badge variant="outline" className="text-[10px]">{item.selectedColor}</Badge>
          )}
          {item.selectedSize && (
            <Badge variant="outline" className="text-[10px]">{item.selectedSize}</Badge>
          )}
          {item.retailPrice != null && (
            <span className="text-sm font-bold text-emerald-500">${item.retailPrice.toFixed(2)}</span>
          )}
          {item.earnings != null && item.earnings > 0 && (
            <span className="text-[10px] text-green-400">+${item.earnings.toFixed(2)}</span>
          )}
        </div>

        {(onEdit || onRemove || onShare) && (
          <div className="flex items-center gap-1 pt-1">
            {onEdit && (
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(item); }} data-testid={`button-edit-packet-${item.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {onShare && (
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onShare(item); }} data-testid={`button-share-packet-${item.id}`}>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
            {onRemove && (
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onRemove(item); }} data-testid={`button-remove-packet-${item.id}`}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
