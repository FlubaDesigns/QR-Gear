import { useState, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Crop as CropIcon, Info } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ItemModalView } from "@/features/shared/components/views/ModalView";
import type { GridViewItem } from "@/features/shared/components/views/index";
import { DeleteSkin } from "@/features/shared/components/skins/DeleteSkin";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

// ── Error boundary ────────────────────────────────────────────────────────────

// Fix 1: error boundary so crashes are recoverable
class CroppedImagesBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CroppedImagesTab] CRASH:", error.message, error.stack);
    console.error("[CroppedImagesTab] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
          <h3 className="font-bold text-lg mb-2">Cropped Images Error</h3>
          <p className="text-sm mb-2">{this.state.error?.message}</p>
          <pre className="text-xs overflow-auto max-h-40 bg-black/20 p-2 rounded">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded"
            data-testid="button-retry-cropped"
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

function CroppedImagesTabInner() {
  const { api } = useLibraryContext();
  const { toast } = useToast();

  const [selectedItem,   setSelectedItem]   = useState<GridViewItem | null>(null);
  const [singleViewOpen, setSingleViewOpen] = useState(false);

  // Fix 2: destructure error so backend failures are shown
  const { data: assets = [], isLoading, error: queryError } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("cropped"),
    queryFn:  () => api.fetchAssets("cropped"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("cropped");
      setSingleViewOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      console.error("[CroppedImagesTab] Delete error:", error);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const gridItems = useMemo(() => assets.map(assetToGridItem), [assets]);

  const handleSelect = (item: GridViewItem) => {
    setSelectedItem(item);
    setSingleViewOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <>
      {/* Fix 4: GRF context note */}
      <div
        className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 mb-4"
        data-testid="info-grf-cropped"
      >
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          9:16 crops derived from source images. Mint GRF-02-2-NNNNNN (cropped_derivative) assets from the Graphics tab.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-cropped-count">
            {assets.length} Cropped Images
          </h3>
          <p className="text-sm text-muted-foreground">9:16 cropped images ready for product design</p>
        </div>
      </div>

      {/* Fix 2: query error panel */}
      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4" data-testid="error-cropped">
          <p className="text-sm font-medium">Failed to load cropped images</p>
          <p className="text-xs text-muted-foreground">{(queryError as Error).message}</p>
        </div>
      )}

      {assets.length === 0 && !isLoading && !queryError ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <CropIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-cropped">
            No cropped images yet.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cropped images appear here after you crop source images.
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
          emptyMessage="No cropped images yet."
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
        <DeleteSkin
          itemId={selectedItem?.id || ""}
          onDelete={handleDelete}
          onClose={() => setSingleViewOpen(false)}
          isDeleting={deleteMutation.isPending}
        />
      </ItemModalView>
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function CroppedImagesTab() {
  return (
    <CroppedImagesBoundary>
      <CroppedImagesTabInner />
    </CroppedImagesBoundary>
  );
}
