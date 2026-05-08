import { useState, useMemo, useCallback, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import JSZip from "jszip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLibraryContext } from "../LibraryContext";
import { ImageUploader } from "@/features/shared/components/utilities/ImageUploader";
import { CropUtility, type CropAsset } from "@/features/shared/components/utilities/CropUtility";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ItemModalView } from "@/features/shared/components/views/ModalView";
import type { GridViewItem } from "@/features/shared/components/views/index";
import { CropDeleteSkin } from "@/features/shared/components/skins/CropDeleteSkin";
import type { LibraryAssetWithProxy } from "../shared/types";
import { getImageUrl } from "../shared/imageUtils";

// ── Error boundary ────────────────────────────────────────────────────────────

class SourceImagesBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SourceImagesTab] CRASH:", error.message, error.stack);
    console.error("[SourceImagesTab] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
          <h3 className="font-bold text-lg mb-2">Source Images Error</h3>
          <p className="text-sm mb-2">{this.state.error?.message}</p>
          <pre className="text-xs overflow-auto max-h-40 bg-black/20 p-2 rounded">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded"
            data-testid="button-retry-source-images"
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

// Fix 6: no try/catch — let ErrorBoundary surface any real mapping error
function assetToGridItem(asset: LibraryAssetWithProxy): GridViewItem {
  const url = getImageUrl(asset);
  return {
    id: asset.id,
    name: asset.name,
    imageUrl: url,
    dimensions: asset.width && asset.height ? `${asset.width}x${asset.height}` : undefined,
  };
}

// Derive MIME type from file extension
function extToMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png":  return "image/png";
    case "webp": return "image/webp";
    case "gif":  return "image/gif";
    default:     return "image/jpeg";
  }
}

// ── Inner tab ─────────────────────────────────────────────────────────────────

function SourceImagesTabInner() {
  const { api } = useLibraryContext();
  const { toast } = useToast();

  const [selectedItem,    setSelectedItem]    = useState<GridViewItem | null>(null);
  const [singleViewOpen,  setSingleViewOpen]  = useState(false);
  const [cropDialogOpen,  setCropDialogOpen]  = useState(false);
  const [assetToCrop,     setAssetToCrop]     = useState<CropAsset | null>(null);

  const { data: assets = [], isLoading, error: queryError } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("source"),
    queryFn: () => api.fetchAssets("source"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      toast({ title: "Image deleted" });
      api.invalidateAssets("source");
      setSingleViewOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      console.error("[SourceImages] Delete error:", error);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  // Fix 6: no try/catch — ErrorBoundary handles real errors
  const gridItems = useMemo(() => assets.map(assetToGridItem), [assets]);

  const handleSelect = (item: GridViewItem) => {
    setSelectedItem(item);
    setSingleViewOpen(true);
  };

  const handleCrop = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (asset) {
      setAssetToCrop({
        id: asset.id,
        name: asset.name,
        imageUrl: getImageUrl(asset),
      });
      setSingleViewOpen(false);
      setCropDialogOpen(true);
    } else {
      console.error("[SourceImages] Asset not found for crop:", id);
    }
  };

  const handleCropComplete = useCallback(async (croppedDataUrl: string) => {
    if (!assetToCrop) {
      console.error("[SourceImages] handleCropComplete called but no assetToCrop");
      return;
    }
    const sourceAsset  = assetToCrop;
    const sourceId     = sourceAsset.id;
    const originalAsset = assets.find(a => a.id === sourceId);
    setCropDialogOpen(false);
    setAssetToCrop(null);

    // Auto-download the original before it moves to background
    if (originalAsset) {
      try {
        const blobUrl = await api.fetchImageBlob(getImageUrl(originalAsset));
        const a = document.createElement("a");
        a.href = blobUrl;
        const ext = originalAsset.mimeType?.includes("png") ? ".png" : ".jpg";
        a.download = `${originalAsset.name || "original"}${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (dlErr) {
        console.error("[SourceImages] Failed to download original:", dlErr);
        toast({
          title: "Could not download original",
          description: "Crop will still be saved",
          variant: "destructive",
        });
      }
    }

    const imageData = croppedDataUrl.includes(",")
      ? croppedDataUrl.split(",")[1]
      : croppedDataUrl;

    toast({ title: "Saving cropped image…" });
    try {
      await api.uploadAsset({
        name:          `cropped_${sourceAsset.name}`,
        assetType:     "cropped",
        imageData,
        mimeType:      "image/jpeg",
        sourceAssetId: sourceId,
      });
      toast({ title: "Cropped image saved" });
      api.invalidateAssets("source");
      api.invalidateAssets("cropped");
      api.invalidateAssets("background");
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[SourceImages] Crop save error:", error.message, error.stack);
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
  }, [assetToCrop, assets, api, toast]);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Fix 4: no debug console.log
  const handleUploadSingle = async (params: { name: string; imageData: string; mimeType: string }) => {
    await api.uploadAsset({
      name:      params.name,
      assetType: "source",
      imageData: params.imageData,
      mimeType:  params.mimeType,
    });
    api.invalidateAssets("source");
  };

  // Fix 1: Client-side ZIP extraction using JSZip — never send raw ZIP to backend
  const handleUploadZip = async (params: { name: string; imageData: string; mimeType: string }): Promise<{ extractedCount: number }> => {
    let zip: JSZip;
    try {
      // Decode base64 → Uint8Array → JSZip
      const binary    = atob(params.imageData);
      const bytes     = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      zip = await new JSZip().loadAsync(bytes);
    } catch (err) {
      console.error("[SourceImages] ZIP parse error:", err);
      throw new Error("Could not parse ZIP file — it may be corrupt or password-protected.");
    }

    const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

    // Collect valid image entries (skip directories, skip __MACOSX junk)
    const imageEntries: Array<{ filename: string; file: JSZip.JSZipObject }> = [];
    zip.forEach((relativePath, file) => {
      if (file.dir) return;
      if (relativePath.startsWith("__MACOSX")) return;
      const ext = relativePath.split(".").pop()?.toLowerCase() ?? "";
      if (IMAGE_EXTS.has(ext)) imageEntries.push({ filename: relativePath, file });
    });

    if (imageEntries.length === 0) {
      throw new Error("No image files found in ZIP. Supported: JPG, PNG, WebP, GIF.");
    }

    let successCount = 0;
    for (const { filename, file } of imageEntries) {
      const ext      = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = extToMime(ext);
      const baseName = filename.split("/").pop()?.replace(/\.[^/.]+$/, "") || filename;
      try {
        const base64 = await file.async("base64");
        await handleUploadSingle({ name: baseName, imageData: base64, mimeType });
        successCount++;
      } catch (err) {
        console.error("[SourceImages] Failed to upload extracted image:", filename, err);
      }
    }

    return { extractedCount: successCount };
  };

  return (
    <>
      {/* Fix 7: GRF staging note */}
      <div
        className="flex items-start gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 mb-4"
        data-testid="info-grf-staging"
      >
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Staged source uploads — no GRF ID assigned yet. After cropping, images move to Backgrounds. Mint GRF IDs from the Graphics tab.
        </p>
      </div>

      <ImageUploader
        onUploadSingle={handleUploadSingle}
        onUploadZip={handleUploadZip}
        title="Upload Source Images"
        description="ZIP files are extracted in the browser — each image is uploaded individually."
      />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{assets.length} Source Images</h3>
      </div>

      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4" data-testid="error-source-images">
          <p className="text-sm font-medium">Failed to load images</p>
          <p className="text-xs text-muted-foreground">{(queryError as Error).message}</p>
        </div>
      )}

      <ScrollGridView
        items={gridItems}
        renderItem={(item) => (
          <div
            className="relative rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/50 transition-all"
            onClick={() => handleSelect(item)}
            data-testid={`card-grid-item-${item.id}`}
          >
            {/* Fix 5: broken image placeholder */}
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
        emptyMessage="No source images uploaded yet."
        columns="grid-cols-2 sm:grid-cols-3"
        height="auto"
        footer={null}
      />

      <ItemModalView
        item={selectedItem ? {
          id:         selectedItem.id,
          name:       selectedItem.name,
          imageUrl:   selectedItem.imageUrl,
          dimensions: selectedItem.dimensions,
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
        onCropComplete={handleCropComplete}
        fetchImageBlob={api.fetchImageBlob}
        aspectRatio={9 / 16}
        title="Crop Image"
        allowCropToggle={false}
      />
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function SourceImagesTab() {
  return (
    <SourceImagesBoundary>
      <SourceImagesTabInner />
    </SourceImagesBoundary>
  );
}
