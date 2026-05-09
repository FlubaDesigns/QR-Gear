import { Component, useState } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SkinHorizontalViewer } from "@/features/shared/components/SkinHorizontalViewer";
import { AdminGraphicCardSkin, grfAssetToSkinItem } from "@/features/shared/components/skins/AdminGraphicSkins";
import { AdminGraphicShape } from "@/features/shared/components/shapes/AdminGraphicShape";
import { adminFetch } from "@/lib/adminFetch";
import type { GrfAsset } from "@/features/shared/components/skins/AdminGraphicSkins";

// ── The three reusable graphic types shown in this tab ────────────────────────
// These are the only GRF asset types that are surface-agnostic and can be
// reused across any product. Store mockups and url snapshots are packet-specific
// and are intentionally excluded.

const REUSABLE_GRAPHIC_TYPES = [
  { channel: '1', purpose: '1', label: 'QR Composite' },
  { channel: '1', purpose: '2', label: 'QR Code' },
  { channel: '3', purpose: '2', label: 'URL Graphic' },
] as const;

type GraphicTypeFilter = 'all' | '1-1' | '1-2' | '3-2';

function isReusableGraphic(a: GrfAsset): boolean {
  return REUSABLE_GRAPHIC_TYPES.some(t => t.channel === a.channel && t.purpose === a.purpose);
}

function getLabelForAsset(a: GrfAsset): string {
  return REUSABLE_GRAPHIC_TYPES.find(t => t.channel === a.channel && t.purpose === a.purpose)?.label ?? '';
}

// ── Error boundary ────────────────────────────────────────────────────────────

class GraphicsBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GraphicsTab] CRASH:", error.message, error.stack);
    console.error("[GraphicsTab] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive rounded-lg">
          <h3 className="font-bold text-lg mb-2">Graphics Error</h3>
          <p className="text-sm mb-2">{this.state.error?.message}</p>
          <pre className="text-xs overflow-auto max-h-40 bg-black/20 p-2 rounded">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded"
            data-testid="button-retry-graphics"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── GraphicsTabInner ──────────────────────────────────────────────────────────

function GraphicsTabInner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [typeFilter, setTypeFilter] = useState<GraphicTypeFilter>("all");

  const { data: assets = [], isLoading, isError, error } = useQuery<GrfAsset[]>({
    queryKey: ["library", "/api/admin", "assets", "grf"],
    queryFn: () => adminFetch<GrfAsset[]>("/graphics"),
  });

  const archiveMutation = useMutation({
    mutationFn: (grfId: string) =>
      adminFetch(`/graphics/${grfId}/archive`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", "/api/admin", "assets", "grf"] });
      toast({ title: "Archived", description: "Graphic removed from library" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive graphic", variant: "destructive" });
    },
  });

  // Only the three surface-agnostic types are shown
  const reusable = assets.filter(isReusableGraphic);

  const filtered = reusable.filter((a) => {
    if (typeFilter === "all") return true;
    const [ch, pu] = typeFilter.split('-');
    return a.channel === ch && a.purpose === pu;
  });

  const skinItems = filtered.map(grfAssetToSkinItem);

  if (isError) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3" data-testid="error-graphics">
        <p className="text-sm font-semibold text-destructive">Failed to load graphics</p>
        <p className="text-xs text-destructive/80 mt-0.5">{(error as Error)?.message ?? "Unknown error"}</p>
      </div>
    );
  }

  const filterHeader = (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setTypeFilter("all")}
        data-testid="tab-type-all"
        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          typeFilter === "all"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        }`}
      >
        All
      </button>
      {REUSABLE_GRAPHIC_TYPES.map((t) => {
        const key = `${t.channel}-${t.purpose}` as GraphicTypeFilter;
        const count = reusable.filter(a => a.channel === t.channel && a.purpose === t.purpose).length;
        return (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            data-testid={`tab-type-${key}`}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              typeFilter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {count > 0 && (
              <span className="ml-1 opacity-60">({count})</span>
            )}
          </button>
        );
      })}
      <span className="text-xs text-muted-foreground ml-auto" data-testid="text-graphics-count">
        {filtered.length} / {reusable.length}
      </span>
    </div>
  );

  return (
    <SkinHorizontalViewer
      items={skinItems}
      CardSkin={AdminGraphicCardSkin}
      Shape={AdminGraphicShape}
      actions={{ onArchive: (id) => archiveMutation.mutate(id) }}
      isActionPending={archiveMutation.isPending}
      cardWidth="160px"
      isLoading={isLoading}
      emptyMessage={reusable.length === 0
        ? 'No graphics saved yet. Use "Save to Library" in the Products Builder.'
        : "No graphics match the selected type."}
      emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
      confirmAction={{
        type: "archive",
        title: "Archive this graphic?",
        description: "This will hide the graphic from your library. The underlying image file is not deleted.",
      }}
      header={filterHeader}
    />
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function GraphicsTab() {
  return (
    <GraphicsBoundary>
      <GraphicsTabInner />
    </GraphicsBoundary>
  );
}
