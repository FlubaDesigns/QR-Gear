import { useState, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus } from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { queryClient } from "@/lib/queryClient";
import { ImageUploader } from "@/features/shared/components/utilities/ImageUploader";
import { CropUtility, type CropAsset } from "@/features/shared/components/utilities/CropUtility";
import { SkinGridViewer } from "@/features/shared/components/SkinGridViewer";
import { SourceImageCardSkin, SourceImageDetailSkin } from "@/features/shared/components/skins";
import type { SkinItem } from "@/features/shared/components/skins/types";
import { originalGrfParams, buildCropTransition, GRF_FILTER_ORIGINALS } from "../shared/GRF_engine";
import { ORIGINALS_QK, CROPPED_QK, BACKGROUNDS_QK } from "../shared/grfQueryKeys";

// ── GRF asset shape ───────────────────────────────────────────────────────────

interface GrfAsset {
  id: string;
  grfId: string;
  name: string;
  publicUrl: string;
  mimeType: string;
  originalFilename?: string | null;
  sourceGrfId?: string | null;
  channel: string;
  purpose: string;
  isActive: boolean;
}

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
            data-testid="button-retry-source"
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

function assetToSkinItem(asset: GrfAsset): SkinItem {
  return {
    id:           asset.id,
    name:         asset.name,
    primaryImage: asset.publicUrl || "",
  };
}

async function fetchImageBlob(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ── Inner component ───────────────────────────────────────────────────────────

function SourceImagesTabInner() {
  const { toast } = useToast();
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop, setAssetToCrop] = useState<CropAsset | null>(null);

  const { data: assets = [], isLoading, error: queryError } = useQuery<GrfAsset[]>({
    queryKey: ORIGINALS_QK,
    queryFn: () =>
      adminFetch<GrfAsset[]>(
        `/graphics?channel=${GRF_FILTER_ORIGINALS.channel}&purpose=${GRF_FILTER_ORIGINALS.purpose}`
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/graphics/${id}/archive`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Image archived" });
      queryClient.invalidateQueries({ queryKey: ORIGINALS_QK });
    },
    onError: (error: Error) => {
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    },
  });

  const skinItems = useMemo(() => assets.map(assetToSkinItem), [assets]);

  const handleCrop = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) {
      console.error("[SourceImagesTab] Asset not found for crop:", id);
      return;
    }
    setAssetToCrop({ id: asset.id, name: asset.name, imageUrl: asset.publicUrl || "" });
    setCropDialogOpen(true);
  };

  const handleSaveCrop = async (croppedDataUrl: string, sourceAsset?: CropAsset) => {
    if (!sourceAsset) {
      console.error("[SourceImagesTab] handleSaveCrop called without sourceAsset");
      toast({ title: "Crop failed", description: "No source asset provided.", variant: "destructive" });
      return;
    }

    const originalAsset = assets.find(a => a.id === sourceAsset.id);
    if (!originalAsset) {
      console.error("[SourceImagesTab] Original asset not found:", sourceAsset.id);
      toast({ title: "Crop failed", description: "Original asset not found.", variant: "destructive" });
      return;
    }

    const transition = buildCropTransition(originalAsset.mimeType || "image/jpeg", "image/jpeg");

    try {
      // 1. Cropped derivative — purpose 2
      await adminFetch("/graphics/save-grf", {
        method: "POST",
        json: {
          ...transition.cropped,
          imageUrl:         croppedDataUrl,
          name:             `cropped_${originalAsset.name}`,
          mimeType:         "image/jpeg",
          sourceGrfId:      originalAsset.grfId || originalAsset.id,
          originalFilename: `cropped_${originalAsset.originalFilename || originalAsset.name}.jpg`,
        },
      });

      // 2. Promoted background — purpose 3
      await adminFetch("/graphics/save-grf", {
        method: "POST",
        json: {
          ...transition.background,
          imageUrl:         originalAsset.publicUrl,
          name:             originalAsset.name,
          mimeType:         originalAsset.mimeType || "image/jpeg",
          sourceGrfId:      originalAsset.grfId || originalAsset.id,
          originalFilename: originalAsset.originalFilename || originalAsset.name,
        },
      });

      toast({ title: "Crop saved", description: "Created cropped derivative and background asset." });
      queryClient.invalidateQueries({ queryKey: ORIGINALS_QK });
      queryClient.invalidateQueries({ queryKey: CROPPED_QK });
      queryClient.invalidateQueries({ queryKey: BACKGROUNDS_QK });
      setCropDialogOpen(false);
      setAssetToCrop(null);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[SourceImagesTab] Crop save error:", error.message);
      toast({ title: "Crop save failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const handleUploadSingle = async (params: { name: string; imageData: string; mimeType: string }) => {
    try {
      await adminFetch("/graphics/save-grf", {
        method: "POST",
        json: {
          ...originalGrfParams(params.mimeType),
          imageUrl:         `data:${params.mimeType};base64,${params.imageData}`,
          name:             params.name,
          mimeType:         params.mimeType,
          originalFilename: params.name,
        },
      });
      toast({ title: "Image uploaded" });
      queryClient.invalidateQueries({ queryKey: ORIGINALS_QK });
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[SourceImagesTab] Upload error:", error.message);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  return (
    <>
      <ImageUploader
        onUploadSingle={handleUploadSingle}
        title="Upload Source Images"
        description="Source images are original GRF library intake assets. Cropping automatically creates a cropped derivative and a background asset."
      />

      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4" data-testid="error-source">
          <p className="text-sm font-medium">Failed to load source images</p>
          <p className="text-xs text-muted-foreground">{(queryError as Error).message}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{assets.length} Source Images</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <ImagePlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-source">
            No source images uploaded yet.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload images above to add them to the GRF library.
          </p>
        </div>
      ) : (
        <SkinGridViewer
          items={skinItems}
          CardSkin={SourceImageCardSkin}
          DetailSkin={SourceImageDetailSkin}
          actions={{
            onCrop:   handleCrop,
            onDelete: handleDelete,
          }}
          isActionPending={deleteMutation.isPending}
          confirmAction={{
            type:        "delete",
            title:       "Archive this image?",
            description: "This will archive the source image. It will no longer appear in this tab.",
          }}
        />
      )}

      <CropUtility
        asset={assetToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setAssetToCrop(null);
        }}
        onSave={handleSaveCrop}
        fetchImageBlob={fetchImageBlob}
        aspectRatio={9 / 16}
        title="Crop Image"
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
