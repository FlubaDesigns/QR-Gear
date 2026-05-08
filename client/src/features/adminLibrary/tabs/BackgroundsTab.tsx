import { useState, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Image as ImageIcon, Info } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { CropUtility, type CropAsset } from "@/features/shared/components/utilities/CropUtility";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ItemModalView } from "@/features/shared/components/views/ModalView";
import type { GridViewItem } from "@/features/shared/components/views/index";
import { CropDeleteSkin } from "@/features/shared/components/skins/CropDeleteSkin";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

// ── Error boundary ────────────────────────────────────────────────────────────

// Fix 1: error boundary so crashes are recoverable
class BackgroundsBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BackgroundsTab] CRASH:", error.message, error.stack);
    console.error("[BackgroundsTab] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
          <h3 className="font-bold text-lg mb-2">Backgrounds Error</h3>
          <p className="text-sm mb-2">{this.state.error?.message}</p>
          <pre className="text-xs overflow-auto max-h-40 bg-black/20 p-2 rounded">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded"
            data-testid="button-retry-backgrounds"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function assetToGridItem(asset: LibraryAssetWithProxy): GridViewItem {
  return {
    id:         asset.id,
    name:       asset.name,
    imageUrl:   getImageUrl(asset),
    dimensions: asset.width && asset.height ? `${asset.width}x${asset.height}` : undefined,
  };
}

// ── Inner tab ─────────────────────────────────────────────────────────────────

function BackgroundsTabInner() {
  const { api } = useLibraryContext();
  const { toast } = useToast();

  const [selectedItem,   setSelectedItem]   = useState<GridViewItem | null>(null);
  const [singleViewOpen, setSingleViewOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop,    setAssetToCrop]    = useState<CropAsset | null>(null);

  // Fix 2: destructure error so backend failures are shown
  const { data: assets = [], isLoading, error: queryError } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("background"),
    queryFn:  () => api.fetchAssets("background"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("background");
      setSingleViewOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      console.error("[BackgroundsTab] Delete error:", error);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const gridItems = useMemo(() => assets.map(assetToGridItem), [assets]);

  const handleSelect = (item: GridViewItem) => {
    setSelectedItem(item);
    setSingleViewOpen(true);
  };

  const handleCrop = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (asset) {
      setAssetToCrop({
        id:       asset.id,
        name:     asset.name,
        imageUrl: getImageUrl(asset),
      });
      setSingleViewOpen(false);
      setCropDialogOpen(true);
    } else {
      // Fix 6: fail loudly if asset not found
      console.error("[BackgroundsTab] Asset not found for crop:", id);
    }
  };

  // Fix 4 + Fix 5: error handling and loud bailout
  const handleSaveCrop = async (imageData: string, sourceAsset?: CropAsset) => {
    if (!sourceAsset) {
      // Fix 5: fail loudly instead of silent return
      console.error("[BackgroundsTab] handleSaveCrop called without sourceAsset");
      return;
    }
    try {
      await api.uploadAsset({
        name:          `cropped_${sourceAsset.name}`,
        assetType:     "cropped",
        imageData,
        mimeType:      "image/jpeg",
        sourceAssetId: sourceAsset.id,
      });
      toast({ title: "Crop saved" });
      api.invalidateAssets("cropped");
      api.invalidateAssets("background");
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[BackgroundsTab] Crop save error:", error.message);
      toast({ title: "Crop save failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <>
      {/* Fix 7: GRF context note */}
      <div
        className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 mb-4"
        data-testid="info-grf-backgrounds"
      >
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Archived originals from the crop pipeline. Mint GRF-03-3-NNNNNN (background) assets from the Graphics tab.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-backgrounds-count">
            {assets.length} Background Images
          </h3>
          <p className="text-sm text-muted-foreground">Archived originals from cropped source images</p>
        </div>
      </div>

      {/* Fix 2: query error panel */}
      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4" data-testid="error-backgrounds">
          <p className="text-sm font-medium">Failed to load background images</p>
          <p className="text-xs text-muted-foreground">{(queryError as Error).message}</p>
        </div>
      )}

      {assets.length === 0 && !isLoading && !queryError ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-backgrounds">
            No background images yet.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Original images move here after cropping.
          </p>
        </div>
      ) : (
        <ScrollGridView
          items={gridItems}
          renderItem={(item) => (
            <div
              className="relative rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/50 transition-all"
              onClick={() => handleSelect(item)}
              data-testid={`card-grid-item-${item.id}`}
            >
              {/* Fix 3: broken image placeholder */}
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="w-full h-auto" />
              ) : (
                <div className="flex flex-col items-center justify-center bg-muted h-32 gap-1" data-testid={`placeholder-no-url-${item.id}`}>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-destructive font-mono">No URL</span>
                </div>
              )}
            </div>
          )}
          isLoading={isLoading}
          emptyMessage="No background images yet."
          columns="grid-cols-2 sm:grid-cols-3"
          height="auto"
          footer={null}
        />
      )}

      <ItemModalView
        item={selectedItem ? {
          id:       selectedItem.id,
          name:     selectedItem.name,
          imageUrl: selectedItem.imageUrl,
        } : null}
        open={singleViewOpen}
        onOpenChange={setSingleViewOpen}
      >
        <CropDeleteSkin
          itemId={selectedItem?.id || ""}
          onCrop={handleCrop}
          onDelete={handleDelete}
          onClose={() => setSingleViewOpen(false)}
          isDeleting={deleteMutation.isPending}
        />
      </ItemModalView>

      <CropUtility
        asset={assetToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setAssetToCrop(null);
        }}
        onSave={handleSaveCrop}
        fetchImageBlob={api.fetchImageBlob}
        aspectRatio={9 / 16}
        title="Crop Image"
      />
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function BackgroundsTab() {
  return (
    <BackgroundsBoundary>
      <BackgroundsTabInner />
    </BackgroundsBoundary>
  );
}
