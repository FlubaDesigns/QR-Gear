import { useState, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon } from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { queryClient } from "@/lib/queryClient";
import { CropUtility, type CropAsset } from "@/features/shared/components/utilities/CropUtility";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { BackgroundCardSkin } from "@/features/shared/components/skins/BackgroundSkin";
import { BackgroundShape } from "@/features/shared/components/shapes/BackgroundShape";
import type { SkinItem } from "@/features/shared/components/skins/types";
import { GRF_FILTER_BACKGROUNDS, buildCropTransition } from "@shared/GRF_engine";
import { BACKGROUNDS_QK, CROPPED_QK } from "../shared/grfQueryKeys";

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

// ── SkinItem mapper ───────────────────────────────────────────────────────────

function assetToSkinItem(asset: GrfAsset): SkinItem {
  return {
    id:           asset.grfId || asset.id,
    name:         asset.name || asset.originalFilename || "Untitled",
    primaryImage: asset.publicUrl || "",
    metadata: {
      raw:         asset,
      grfId:       asset.grfId || asset.id,
      mimeType:    asset.mimeType,
      sourceGrfId: asset.sourceGrfId ?? undefined,
    },
  };
}

async function fetchImageBlob(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ── Error boundary ────────────────────────────────────────────────────────────

class BackgroundsBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
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

// ── Inner tab ─────────────────────────────────────────────────────────────────

function BackgroundsTabInner() {
  const { toast } = useToast();
  const [selectedItem,   setSelectedItem]   = useState<SkinItem | null>(null);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [assetToCrop,    setAssetToCrop]    = useState<CropAsset | null>(null);

  const { data: assets = [], isLoading, error: queryError } = useQuery<GrfAsset[]>({
    queryKey: BACKGROUNDS_QK,
    queryFn:  () =>
      adminFetch<GrfAsset[]>(
        `/graphics?channel=${GRF_FILTER_BACKGROUNDS.channel}&purpose=${GRF_FILTER_BACKGROUNDS.purpose}`
      ),
  });

  const archiveMutation = useMutation({
    mutationFn: (skinId: string) => {
      const raw = assets.find(a => (a.grfId || a.id) === skinId);
      const id  = raw?.id ?? skinId;
      return adminFetch(`/graphics/${id}/archive`, { method: "PATCH" });
    },
    onSuccess: () => {
      toast({ title: "Image archived" });
      queryClient.invalidateQueries({ queryKey: BACKGROUNDS_QK });
      setDetailOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      console.error("[BackgroundsTab] Archive error:", error.message);
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    },
  });

  const skinItems = useMemo(() => assets.map(assetToSkinItem), [assets]);

  const handleSelect = (item: SkinItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleStartCrop = (skinId: string) => {
    const raw = assets.find(a => (a.grfId || a.id) === skinId);
    if (!raw) {
      console.error("[BackgroundsTab] Asset not found for crop:", skinId);
      return;
    }
    setAssetToCrop({ id: raw.id, name: raw.name, imageUrl: raw.publicUrl || "" });
    setDetailOpen(false);
    setCropDialogOpen(true);
  };

  const handleArchive = (skinId: string) => archiveMutation.mutate(skinId);

  const handleSaveCrop = async (croppedDataUrl: string, sourceAsset?: CropAsset) => {
    if (!sourceAsset) {
      console.error("[BackgroundsTab] handleSaveCrop called without sourceAsset");
      return;
    }
    const originalAsset = assets.find(a => a.id === sourceAsset.id);
    if (!originalAsset) {
      console.error("[BackgroundsTab] Original asset not found:", sourceAsset.id);
      toast({ title: "Crop failed", description: "Original asset not found.", variant: "destructive" });
      return;
    }
    try {
      const originalMimeType = originalAsset.mimeType || "image/jpeg";
      const croppedMimeType  = "image/jpeg";
      const { cropped: croppedGrfParams, background: backgroundGrfParams } =
        buildCropTransition(originalMimeType, croppedMimeType);

      const croppedImageData = croppedDataUrl.startsWith("data:")
        ? croppedDataUrl.replace(/^data:[^;]+;base64,/, "")
        : croppedDataUrl;

      await adminFetch("/library/crop-mint", {
        method: "POST",
        json: {
          croppedImageData,
          croppedMimeType,
          croppedGrfParams,
          backgroundGrfParams,
          originalPublicUrl: originalAsset.publicUrl,
          name:              originalAsset.originalFilename || originalAsset.name,
          sourceGrfId:       originalAsset.sourceGrfId || originalAsset.grfId || originalAsset.id,
        },
      });

      toast({ title: "Crop saved", description: "Cropped derivative and background asset created." });
      queryClient.invalidateQueries({ queryKey: CROPPED_QK });
      queryClient.invalidateQueries({ queryKey: BACKGROUNDS_QK });
      setCropDialogOpen(false);
      setAssetToCrop(null);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[BackgroundsTab] Crop save error:", error.message);
      toast({ title: "Crop save failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide" data-testid="text-backgrounds-count">
          {assets.length} Background Images
        </h3>
      </div>

      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4" data-testid="error-backgrounds">
          <p className="text-sm font-medium">Failed to load background images</p>
          <p className="text-xs text-muted-foreground">{(queryError as Error).message}</p>
        </div>
      )}

      {assets.length === 0 && !isLoading && !queryError ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg" data-testid="empty-backgrounds">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No background images yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crop a source image to promote its original here as a background asset.
          </p>
        </div>
      ) : (
        <ScrollGridView
          items={skinItems}
          isLoading={isLoading}
          emptyMessage="No background images yet."
          emptyIcon={<ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
          columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          height="auto"
          footer={null}
          renderItem={(item) => (
            <BackgroundCardSkin
              item={item}
              onClick={() => handleSelect(item)}
              actions={{
                onCrop:   handleStartCrop,
                onDelete: handleArchive,
              }}
              isActionPending={archiveMutation.isPending}
            />
          )}
        />
      )}

      <BackgroundShape
        open={detailOpen}
        item={selectedItem}
        actions={{
          onCrop:   handleStartCrop,
          onDelete: handleArchive,
        }}
        onClose={() => setDetailOpen(false)}
        isActionPending={archiveMutation.isPending}
      />

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
        title="Crop Background"
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
