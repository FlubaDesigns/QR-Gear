import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image, FileText, Video, Layers } from "lucide-react";

export type AssetType = "graphic" | "template" | "background" | "cropped" | "source" | "video" | "document";

export interface AdminLibraryAssetItem {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  assetType: AssetType;
  metadata?: Record<string, string>;
  createdAt?: string;
}

export interface AdminLibraryAssetSkinProps {
  item: AdminLibraryAssetItem;
  onOpen?: (item: AdminLibraryAssetItem) => void;
  size?: "compact" | "standard";
}

const TYPE_ICONS: Record<AssetType, typeof Image> = {
  graphic: Layers,
  template: Layers,
  background: Image,
  cropped: Image,
  source: Image,
  video: Video,
  document: FileText,
};

const TYPE_COLORS: Record<AssetType, string> = {
  graphic: "bg-purple-600 text-white",
  template: "bg-blue-600 text-white",
  background: "bg-amber-600 text-white",
  cropped: "bg-green-600 text-white",
  source: "bg-slate-600 text-white",
  video: "bg-red-600 text-white",
  document: "bg-cyan-600 text-white",
};

export function AdminLibraryAssetSkin({
  item,
  onOpen,
  size = "standard",
}: AdminLibraryAssetSkinProps) {
  const Icon = TYPE_ICONS[item.assetType] || Image;
  const isCompact = size === "compact";

  return (
    <Card
      className="overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onOpen?.(item)}
      data-testid={`library-asset-${item.id}`}
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
          <Icon className="w-10 h-10 text-muted-foreground" />
        )}

        <Badge className={`absolute top-1 left-1 text-[9px] px-1 py-0 ${TYPE_COLORS[item.assetType] || ""}`}>
          {item.assetType}
        </Badge>
      </div>

      <CardContent className={`${isCompact ? "p-1.5" : "p-2"}`}>
        <p className={`font-medium text-foreground ${isCompact ? "text-[10px]" : "text-xs"} truncate`}>
          {item.title}
        </p>
        {item.metadata && !isCompact && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(item.metadata).slice(0, 3).map(([key, val]) => (
              <span key={key} className="text-[9px] text-muted-foreground">{val}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
