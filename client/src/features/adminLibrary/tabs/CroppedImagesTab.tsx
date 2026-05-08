import { useState, useMemo, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Crop as CropIcon } from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { queryClient } from "@/lib/queryClient";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { CroppedCardSkin, CroppedDetailSkin } from "@/features/shared/components/skins/CroppedImageSkin";
import type { SkinItem } from "@/features/shared/components/skins/types";
import { GRF_FILTER_CROPPED } from "../shared/GRF_engine";
import { CROPPED_QK } from "../shared/grfQueryKeys";

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

// ── SkinItem mapper ───────────────────────────────────────────────────────────

function assetToSkinItem(asset: GrfAsset): SkinItem {
  return {
    id:           asset.grfId || asset.id,
    name:         asset.name || asset.originalFilename || "Untitled",
    primaryImage: asset.publicUrl || "",
    metadata: {
      raw:          asset,
      grfId:        asset.grfId || asset.id,
      mimeType:     asset.mimeType,
      sourceGrfId:  asset.sourceGrfId ?? undefined,
    },
  };
}

// ── Error boundary ────────────────────────────────────────────────────────────

class CroppedImagesBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
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

// ── Inner tab ─────────────────────────────────────────────────────────────────

function CroppedImagesTabInner() {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<SkinItem | null>(null);
  const [detailOpen,   setDetailOpen]   = useState(false);

  const { data: assets = [], isLoading, error: queryError } = useQuery<GrfAsset[]>({
    queryKey: CROPPED_QK,
    queryFn:  () =>
      adminFetch<GrfAsset[]>(
        `/graphics?channel=${GRF_FILTER_CROPPED.channel}&purpose=${GRF_FILTER_CROPPED.purpose}`
      ),
  });

  const archiveMutation = useMutation({
    mutationFn: (grfId: string) => {
      const raw = assets.find(a => (a.grfId || a.id) === grfId);
      const id  = raw?.id ?? grfId;
      return adminFetch(`/graphics/${id}/archive`, { method: "PATCH" });
    },
    onSuccess: () => {
      toast({ title: "Image archived" });
      queryClient.invalidateQueries({ queryKey: CROPPED_QK });
      setDetailOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      console.error("[CroppedImagesTab] Archive error:", error.message);
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    },
  });

  const skinItems = useMemo(() => assets.map(assetToSkinItem), [assets]);

  const handleSelect = (item: SkinItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleArchive = (id: string) => archiveMutation.mutate(id);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide" data-testid="text-cropped-count">
          {assets.length} Cropped Images
        </h3>
      </div>

      {queryError && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-lg mb-4" data-testid="error-cropped">
          <p className="text-sm font-medium">Failed to load cropped images</p>
          <p className="text-xs text-muted-foreground">{(queryError as Error).message}</p>
        </div>
      )}

      {assets.length === 0 && !isLoading && !queryError ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg" data-testid="empty-cropped">
          <CropIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No cropped images yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crop a source image from the Source tab to create derivatives here.
          </p>
        </div>
      ) : (
        <ScrollGridView
          items={skinItems}
          isLoading={isLoading}
          emptyMessage="No cropped images yet."
          emptyIcon={<CropIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
          columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          height="auto"
          footer={null}
          renderItem={(item) => (
            <CroppedCardSkin
              item={item}
              onClick={() => handleSelect(item)}
              actions={{ onDelete: handleArchive }}
              isActionPending={archiveMutation.isPending}
            />
          )}
        />
      )}

      {/* Detail popup */}
      {selectedItem && detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDetailOpen(false)}
          data-testid="overlay-cropped-detail"
        >
          <div
            className="bg-background rounded-lg p-6 w-full max-w-xs mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="modal-cropped-detail"
          >
            <CroppedDetailSkin
              item={selectedItem}
              actions={{ onDelete: handleArchive }}
              onClose={() => setDetailOpen(false)}
              isActionPending={archiveMutation.isPending}
            />
          </div>
        </div>
      )}
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
