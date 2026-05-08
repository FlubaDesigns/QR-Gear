import { useState, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus } from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { queryClient } from "@/lib/queryClient";
import { ImageUploader, type UploadParams } from "@/features/shared/components/utilities/ImageUploader";
import { CropUtility, type CropAsset } from "@/features/shared/components/utilities/CropUtility";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { SourceCardSkin } from "@/features/shared/components/skins/SourceSkin";
import { SourceDetailShape } from "@/features/shared/components/shapes/SourceShape";
import type { SkinItem } from "@/features/shared/components/skins/types";
import { originalGrfParams, GRF_FILTER_ORIGINALS } from "../shared/GRF_engine";
import { ORIGINALS_QK, CROPPED_QK, BACKGROUNDS_QK } from "../shared/grfQueryKeys";

// ── GRF asset shape from API ──────────────────────────────────────────────────

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

// ── SkinItem mapper — metadata.raw carries full API asset ─────────────────────

function assetToSkinItem(asset: GrfAsset): SkinItem {
  return {
    id:           asset.grfId || asset.id,
    name:         asset.name || asset.originalFilename || "Untitled",
    primaryImage: asset.publicUrl || "",
    metadata: {
      raw:              asset,
      grfId:            asset.grfId || asset.id,
      mimeType:         asset.mimeType,
      originalFilename: asset.originalFilename ?? undefined,
      channel:          asset.channel,
      purpose:          asset.purpose,
      sourceGrfId:      asset.sourceGrfId ?? undefined,
    },
  };
}

// ── Error boundary ────────────────────────────────────────────────────────────

class SourceImagesBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
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

// ── Inner component ───────────────────────────────────────────────────────────

function SourceImagesTabInner() {
  const { toast } = useToast();
  const [selectedItem,   setSelectedItem]   = useState<SkinItem | null>(null);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop,    setAssetToCrop]    = useState<CropAsset | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data: assets = [], isLoading, error: queryError } = useQuery<GrfAsset[]>({
    queryKey: ORIGINALS_QK,
    queryFn:  () =>
      adminFetch<GrfAsset[]>(
        `/graphics?channel=${GRF_FILTER_ORIGINALS.channel}&purpose=${GRF_FILTER_ORIGINALS.purpose}`
      ),
  });

  const skinItems = useMemo(() => assets.map(assetToSkinItem), [assets]);

  // ── Archive mutation ───────────────────────────────────────────────────────

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/graphics/${id}/archive`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Image archived" });
      queryClient.invalidateQueries({ queryKey: ORIGINALS_QK });
      setDetailOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      console.error("[SourceImagesTab] Archive error:", error.message);
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectItem = (item: SkinItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleStartCrop = (item: SkinItem) => {
    const raw = item.metadata?.raw as GrfAsset | undefined;
    setAssetToCrop({
      id:       item.id,
      name:     item.name,
      imageUrl: item.primaryImage || "",
    });
    setDetailOpen(false);
    setCropDialogOpen(true);
    console.log("[SourceImagesTab] Starting crop for:", item.id, raw?.grfId);
  };

  const handleDelete = (id: string) => archiveMutation.mutate(id);

  const handleUploadSingle = async (params: UploadParams) => {
    const mimeType = params.mimeType || "image/jpeg";
    try {
      await adminFetch("/graphics/save-grf", {
        method: "POST",
        json: {
          ...originalGrfParams(mimeType),
          name:             params.name,
          originalFilename: params.originalFilename || params.name,
          mimeType,
          imageUrl: `data:${mimeType};base64,${params.imageData}`,
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

  const handleSaveCrop = async (croppedDataUrl: string, sourceAsset?: CropAsset) => {
    if (!sourceAsset) {
      console.error("[SourceImagesTab] handleSaveCrop: no sourceAsset");
      return;
    }

    const skinItem = skinItems.find(s => s.id === sourceAsset.id);
    const raw      = skinItem?.metadata?.raw as GrfAsset | undefined;
    const grfId    = raw?.grfId || sourceAsset.id;
    const origMime = raw?.mimeType || "image/jpeg";
    const origName = raw?.name || raw?.originalFilename || sourceAsset.name;
    const origUrl  = raw?.publicUrl || sourceAsset.imageUrl;

    // Strip data URI prefix — crop-mint expects raw base64
    const croppedImageData = croppedDataUrl.startsWith("data:")
      ? croppedDataUrl.replace(/^data:[^;]+;base64,/, "")
      : croppedDataUrl;

    try {
      await adminFetch("/library/crop-mint", {
        method: "POST",
        json: {
          croppedImageData,
          croppedMimeType:   "image/jpeg",
          originalPublicUrl: origUrl,
          originalMimeType:  origMime,
          name:              origName,
          sourceGrfId:       grfId,
        },
      });

      toast({ title: "Crop saved", description: "Cropped derivative and background asset created." });
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <ImageUploader
        onUploadSingle={handleUploadSingle}
        title="Upload Source Images"
        description="Upload original images to the GRF library. Cropping creates a cropped derivative and promotes the original as a background asset."
        showZipUpload={false}
      />

      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4" data-testid="error-source">
          <p className="text-sm font-medium">Failed to load source images</p>
          <p className="text-xs text-muted-foreground">{(queryError as Error).message}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {assets.length} Source Images
        </h3>
      </div>

      {assets.length === 0 && !isLoading && !queryError ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg" data-testid="empty-source">
          <ImagePlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No source images uploaded yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload images above to begin.
          </p>
        </div>
      ) : (
        <ScrollGridView
          items={skinItems}
          isLoading={isLoading}
          emptyMessage="No source images uploaded yet."
          emptyIcon={<ImagePlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
          renderItem={(item) => (
            <SourceCardSkin
              item={item}
              onClick={() => handleSelectItem(item)}
              actions={{
                onCrop:   () => handleStartCrop(item),
                onDelete: () => handleDelete(item.id),
              }}
              isActionPending={archiveMutation.isPending}
            />
          )}
        />
      )}

      {/* Detail modal (popup) */}
      {selectedItem && detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDetailOpen(false)}
          data-testid="overlay-source-detail"
        >
          <div
            className="bg-background rounded-lg p-6 w-full max-w-sm mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="modal-source-detail"
          >
            <SourceDetailShape
              item={selectedItem}
              actions={{
                onCrop:   () => handleStartCrop(selectedItem),
                onDelete: () => handleDelete(selectedItem.id),
              }}
              onClose={() => setDetailOpen(false)}
            />
          </div>
        </div>
      )}

      <CropUtility
        asset={assetToCrop}
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setAssetToCrop(null);
        }}
        onSave={handleSaveCrop}
        aspectRatio={9 / 16}
        title="Crop Source Image"
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
