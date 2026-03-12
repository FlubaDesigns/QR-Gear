import { useState, useMemo, useCallback, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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

function assetToGridItem(asset: LibraryAssetWithProxy): GridViewItem {
  const url = getImageUrl(asset);
  console.log("[SourceImages] assetToGridItem:", asset.id, asset.name, "url:", url);
  return {
    id: asset.id,
    name: asset.name,
    imageUrl: url,
    dimensions: asset.width && asset.height ? `${asset.width}x${asset.height}` : undefined,
  };
}

function SourceImagesTabInner() {
  const { api } = useLibraryContext();
  const { toast } = useToast();
  
  const [selectedItem, setSelectedItem] = useState<GridViewItem | null>(null);
  const [singleViewOpen, setSingleViewOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop, setAssetToCrop] = useState<CropAsset | null>(null);

  const { data: assets = [], isLoading, error: queryError } = useQuery<LibraryAssetWithProxy[]>({
    queryKey: api.getQueryKey("source"),
    queryFn: async () => {
      console.log("[SourceImages] Fetching source assets...");
      try {
        const result = await api.fetchAssets("source");
        console.log("[SourceImages] Fetched", result.length, "assets");
        return result;
      } catch (err) {
        console.error("[SourceImages] Fetch error:", err);
        throw err;
      }
    },
  });

  if (queryError) {
    console.error("[SourceImages] Query error state:", queryError);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      console.log("[SourceImages] Deleting asset:", id);
      return api.deleteAsset(id);
    },
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

  const gridItems = useMemo(() => {
    console.log("[SourceImages] Building grid items from", assets.length, "assets");
    try {
      return assets.map(assetToGridItem);
    } catch (err) {
      console.error("[SourceImages] Error building grid items:", err);
      return [];
    }
  }, [assets]);

  const handleSelect = (item: GridViewItem) => {
    console.log("[SourceImages] Selected:", item.id, item.name);
    setSelectedItem(item);
    setSingleViewOpen(true);
  };

  const handleCrop = (id: string) => {
    console.log("[SourceImages] Opening crop for:", id);
    const asset = assets.find(a => a.id === id);
    if (asset) {
      const url = getImageUrl(asset);
      console.log("[SourceImages] Crop asset URL:", url);
      setAssetToCrop({
        id: asset.id,
        name: asset.name,
        imageUrl: url,
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
    const sourceAsset = assetToCrop;
    const sourceId = sourceAsset.id;
    const originalAsset = assets.find(a => a.id === sourceId);
    console.log("[SourceImages] Crop complete for:", sourceAsset.name, "dataUrl length:", croppedDataUrl.length);
    setCropDialogOpen(false);
    setAssetToCrop(null);

    if (originalAsset) {
      try {
        const originalUrl = getImageUrl(originalAsset);
        console.log("[SourceImages] Downloading original before removal:", originalUrl);
        const blobUrl = await api.fetchImageBlob(originalUrl);
        const a = document.createElement("a");
        a.href = blobUrl;
        const ext = originalAsset.mimeType?.includes("png") ? ".png" : ".jpg";
        a.download = `${originalAsset.name || "original"}${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        console.log("[SourceImages] Original downloaded:", a.download);
      } catch (dlErr) {
        console.error("[SourceImages] Failed to download original:", dlErr);
        toast({ title: "Could not download original", description: "Crop will still be saved", variant: "destructive" });
      }
    }

    const imageData = croppedDataUrl.includes(',')
      ? croppedDataUrl.split(',')[1]
      : croppedDataUrl;

    console.log("[SourceImages] Uploading cropped image, base64 length:", imageData.length);
    toast({ title: "Saving cropped image..." });
    try {
      await api.uploadAsset({
        name: `cropped_${sourceAsset.name}`,
        assetType: "cropped",
        imageData,
        mimeType: "image/jpeg",
        sourceAssetId: sourceId,
      });
      console.log("[SourceImages] Cropped image saved, server moves source to background automatically");
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

  const handleUploadSingle = async (params: { name: string; imageData: string; mimeType: string }) => {
    console.log("[SourceImages] Uploading single:", params.name, "mimeType:", params.mimeType, "data length:", params.imageData.length);
    try {
      await api.uploadAsset({
        name: params.name,
        assetType: "source",
        imageData: params.imageData,
        mimeType: params.mimeType,
      });
      console.log("[SourceImages] Upload success:", params.name);
      api.invalidateAssets("source");
    } catch (err) {
      console.error("[SourceImages] Upload error:", err);
      throw err;
    }
  };

  const handleUploadZip = async (params: { name: string; imageData: string; mimeType: string }) => {
    console.log("[SourceImages] Uploading ZIP:", params.name, "data length:", params.imageData.length);
    try {
      const result = await api.uploadZip({
        name: params.name,
        assetType: "source",
        imageData: params.imageData,
        mimeType: params.mimeType,
      });
      console.log("[SourceImages] ZIP upload success, extracted:", result.extractedCount);
      api.invalidateAssets("source");
      return result;
    } catch (err) {
      console.error("[SourceImages] ZIP upload error:", err);
      throw err;
    }
  };

  return (
    <>
      <ImageUploader
        onUploadSingle={handleUploadSingle}
        onUploadZip={handleUploadZip}
        title="Upload Source Images"
        description="ZIP files are extracted server-side. Original ZIP saved to archive."
      />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{assets.length} Source Images</h3>
      </div>

      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4">
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
            <img src={item.imageUrl} alt="" className="w-full h-auto" />
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
          id: selectedItem.id,
          name: selectedItem.name,
          imageUrl: selectedItem.imageUrl,
          dimensions: selectedItem.dimensions,
        } : null}
        open={singleViewOpen}
        onOpenChange={setSingleViewOpen}
      >
        <CropDeleteSkin
          itemId={selectedItem?.id || ''}
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

export default function SourceImagesTab() {
  return (
    <SourceImagesBoundary>
      <SourceImagesTabInner />
    </SourceImagesBoundary>
  );
}
