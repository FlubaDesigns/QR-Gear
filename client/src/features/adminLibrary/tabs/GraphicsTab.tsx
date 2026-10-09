import { GRF_PACKET_SLOTS, GRF_PURPOSES_BY_CHANNEL } from '@shared/GRF_engine';
import { Component, useState } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { DeleteBuildDialog } from "@/features/shared/components/DeleteBuildDialog";
import { GRAPHICS_QK } from "../shared/grfQueryKeys";
import { SkinHorizontalViewer } from "@/features/shared/components/SkinHorizontalViewer";
import { AdminGraphicCardSkin, grfAssetToSkinItem } from "@/features/shared/components/skins/AdminGraphicSkins";
import { AdminGraphicShape } from "@/features/shared/components/shapes/AdminGraphicShape";
import { adminFetch } from "@/lib/adminFetch";
import type { GrfAsset } from "@/features/shared/components/skins/AdminGraphicSkins";

// ── The three reusable graphic types shown in this tab ────────────────────────
// Show print artwork and website graphics. Store mockups and page snapshots
// remain with their product packets. QR artwork retains its encoded destination.

const REUSABLE_GRAPHIC_TYPES = [GRF_PACKET_SLOTS.qrComposite, GRF_PACKET_SLOTS.qrStandalone,
  { channel: '3' as const, purpose: '2' }].map(({ channel, purpose }) => ({ channel, purpose,
    label: GRF_PURPOSES_BY_CHANNEL[channel][purpose].label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bQr\b/, 'QR') }));

type GraphicTypeFilter = 'all' | '1-1' | '1-2' | '3-2';

function isReusableGraphic(a: GrfAsset): boolean {
  return REUSABLE_GRAPHIC_TYPES.some(t => t.channel === a.channel && t.purpose === a.purpose);
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
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<GraphicTypeFilter>("all");

  const { data: assets = [], isLoading, isError, error } = useQuery<GrfAsset[]>({
    queryKey: GRAPHICS_QK,
    queryFn: () => adminFetch<GrfAsset[]>("/graphics"),
  });

  // Keep the library’s print and website graphic categories together.
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
        aria-pressed={typeFilter === "all"}
        className={`min-h-[44px] px-3 py-2 rounded-md text-xs font-medium transition-colors ${
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
            aria-pressed={typeFilter === key}
            className={`min-h-[44px] px-3 py-2 rounded-md text-xs font-medium transition-colors ${
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
    <>
      <SkinHorizontalViewer
        items={skinItems}
        CardSkin={AdminGraphicCardSkin}
        Shape={AdminGraphicShape}
        actions={{ onDelete: setDeleteId }}
        isActionPending={!!deleteId}
        cardWidth="160px"
        isLoading={isLoading}
        emptyMessage={reusable.length === 0
          ? 'No QR or website graphics registered yet. Builder “Save to Library” images are in the Images tab.'
          : "No graphics match the selected type."}
        emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
        header={filterHeader}
      />
      <DeleteBuildDialog target={deleteId ? { kind: 'graphics', id: deleteId } : null} onClose={() => setDeleteId(null)} />
    </>
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
