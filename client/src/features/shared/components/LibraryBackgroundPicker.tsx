import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Image, RefreshCw, Layers, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/lib/adminFetch";
import { ScrollGridView } from "./views/ScrollGridView";
import type { GridViewItem } from "./views/index";

interface GrfAsset {
  id: string;
  grfId: string;
  name: string;
  publicUrl: string;
  mimeType: string;
  assetClass: string;
  purpose: string;
  isActive: boolean;
}

export interface SelectedBackground {
  id: string;
  name: string;
  url: string;
}

export interface LibraryBackgroundPickerProps {
  selectedId?: string | null;
  onSelect: (background: SelectedBackground) => void;
  onClear?: () => void;
  currentBackground?: SelectedBackground | null;
  enabled?: boolean;
}

function assetToGridItem(asset: GrfAsset): GridViewItem {
  return {
    id: asset.grfId,
    name: asset.name,
    imageUrl: asset.publicUrl,
  };
}

export function LibraryBackgroundPicker({
  selectedId,
  onSelect,
  onClear,
  currentBackground,
  enabled = true,
}: LibraryBackgroundPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { data: assets = [], isLoading } = useQuery<GrfAsset[]>({
    queryKey: ["/api/admin/graphics", { assetClass: "1", purpose: "6" }],
    queryFn: () => adminFetch<GrfAsset[]>("/graphics?assetClass=1&purpose=6"),
    enabled,
  });

  const gridItems = useMemo(() => assets.map(assetToGridItem), [assets]);

  const handleSelect = (item: GridViewItem) => {
    onSelect({ id: item.id, name: item.name, url: item.imageUrl || "" });
    setSelectedIndex(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Background Image</p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" data-testid="loader-backgrounds" />
        </div>
      ) : gridItems.length === 0 ? (
        <div className="text-center py-6 border rounded-md bg-muted/20">
          <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">
            No background images found. Upload a background in the Graphics Library (input build · background).
          </p>
        </div>
      ) : (
        <ScrollGridView
          items={gridItems}
          columns="grid-cols-3"
          height="auto"
          emptyMessage="No items to display."
          emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
          footer={null}
          renderItem={(item) => (
            <div
              className={`relative rounded-md overflow-hidden cursor-pointer ring-2 transition-all ${
                selectedId === item.id ? "ring-primary" : "ring-transparent hover:ring-white/40"
              }`}
              onClick={() => handleSelect(item)}
              data-testid={`card-bg-${item.id}`}
            >
              {item.imageUrl ? (
                <>
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                    {item.name}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center bg-muted aspect-square">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        />
      )}

      {currentBackground && (
        <div className="p-3 bg-primary/5 rounded-md border space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-12 h-16 rounded overflow-hidden border flex-shrink-0">
              <img
                src={currentBackground.url}
                alt={currentBackground.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Background Selected</p>
              <p className="text-xs text-muted-foreground truncate">{currentBackground.name}</p>
            </div>
          </div>
          {onClear && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              className="w-full"
              data-testid="button-clear-background"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Change Background
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
