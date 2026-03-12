import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ExternalLink } from "lucide-react";

export interface MemberLibraryItem {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  subtitle?: string;
  status?: string;
  price?: number;
  earnings?: number;
  itemType?: string;
}

export interface MemberLibraryItemSkinProps {
  item: MemberLibraryItem;
  onOpen?: (item: MemberLibraryItem) => void;
  size?: "compact" | "standard" | "expanded";
}

const STATUS_COLORS: Record<string, string> = {
  published: "bg-green-600 text-white",
  draft: "bg-amber-500 text-white",
  building: "bg-blue-500 text-white",
  archived: "bg-slate-500 text-white",
};

export function MemberLibraryItemSkin({
  item,
  onOpen,
  size = "standard",
}: MemberLibraryItemSkinProps) {
  const isCompact = size === "compact";
  const isExpanded = size === "expanded";

  return (
    <Card
      className="overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onOpen?.(item)}
      data-testid={`member-library-item-${item.id}`}
    >
      <div className={`relative bg-muted flex items-center justify-center ${isCompact ? "h-24" : isExpanded ? "h-52" : "h-36"}`}>
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

        {item.status && (
          <Badge className={`absolute top-1 right-1 text-[9px] px-1 py-0 ${STATUS_COLORS[item.status] || "bg-slate-500 text-white"}`}>
            {item.status}
          </Badge>
        )}

        {item.itemType && (
          <Badge className="absolute top-1 left-1 text-[9px] px-1 py-0 bg-slate-700 text-white">
            {item.itemType}
          </Badge>
        )}
      </div>

      <CardContent className={`${isCompact ? "p-1.5" : "p-2"} space-y-1`}>
        <p className={`font-medium text-foreground ${isCompact ? "text-[10px]" : "text-xs"} truncate`}>
          {item.title}
        </p>
        {item.subtitle && !isCompact && (
          <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
        )}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          {item.price != null && (
            <span className="text-xs font-bold text-emerald-500">${item.price.toFixed(2)}</span>
          )}
          {item.earnings != null && item.earnings > 0 && (
            <span className="text-[10px] text-green-400">+${item.earnings.toFixed(2)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
