import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, Trash2, Pencil, Crop as CropIcon } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import type { LibraryAssetWithProxy } from "../shared/types";

export type AssetAction = "edit" | "delete" | "crop";

interface AssetGridProps {
  assets: LibraryAssetWithProxy[];
  isLoading: boolean;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  emptySubMessage?: string;
  aspectRatio?: "square" | "portrait";
  showTags?: boolean;
  showStatus?: boolean;
  showDimensions?: boolean;
  actions?: AssetAction[];
  onEdit?: (asset: LibraryAssetWithProxy) => void;
  onDelete?: (asset: LibraryAssetWithProxy) => void;
  onCrop?: (asset: LibraryAssetWithProxy) => void;
  gridCols?: string;
}

export function AssetGrid({
  assets,
  isLoading,
  emptyIcon,
  emptyMessage = "No assets found.",
  emptySubMessage,
  aspectRatio = "square",
  showTags = false,
  showStatus = false,
  showDimensions = false,
  actions = ["delete"],
  onEdit,
  onDelete,
  onCrop,
  gridCols = "grid-cols-2 md:grid-cols-4 lg:grid-cols-6",
}: AssetGridProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          {emptyIcon || <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />}
          <p className="text-muted-foreground">{emptyMessage}</p>
          {emptySubMessage && (
            <p className="text-sm text-muted-foreground mt-2">{emptySubMessage}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const aspectClass = aspectRatio === "portrait" ? "aspect-[9/16]" : "aspect-square";

  return (
    <div className={`grid ${gridCols} gap-3`}>
      {assets.map((asset) => (
        <Card 
          key={asset.id} 
          className={`overflow-hidden ${!asset.isActive ? "opacity-50" : ""}`}
          data-testid={`card-asset-${asset.id}`}
        >
          <div className={`${aspectClass} relative`}>
            <SmartImage
              asset={asset}
              alt={asset.name}
              className="w-full h-full object-cover"
            />
            {showTags && (asset.tags || []).length > 0 && (
              <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
                {(asset.tags || []).slice(0, 2).map((tag: string) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
          <CardContent className="p-2">
            <p className="text-xs truncate font-medium">{asset.name}</p>
            
            {(showStatus || showDimensions) && (
              <div className="flex items-center justify-between mt-1">
                {showStatus && (
                  <Badge variant={asset.isActive ? "default" : "secondary"} className="text-xs">
                    {asset.isActive ? "Active" : "Inactive"}
                  </Badge>
                )}
                {showDimensions && asset.width && asset.height && (
                  <span className="text-xs text-muted-foreground">{asset.width}x{asset.height}</span>
                )}
              </div>
            )}

            <div className="flex gap-1 mt-2">
              {actions.includes("crop") && onCrop && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onCrop(asset)}
                  data-testid={`button-crop-${asset.id}`}
                >
                  <CropIcon className="h-3 w-3" />
                </Button>
              )}
              {actions.includes("edit") && onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onEdit(asset)}
                  data-testid={`button-edit-${asset.id}`}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
              {actions.includes("delete") && onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => onDelete(asset)}
                  data-testid={`button-delete-${asset.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
