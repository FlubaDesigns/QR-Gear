import { Component, useState } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SkinHorizontalViewer } from "@/features/shared/components/SkinHorizontalViewer";
import { AdminGraphicCardSkin, grfAssetToSkinItem } from "@/features/shared/components/skins/AdminGraphicSkins";
import { AdminGraphicShape } from "@/features/shared/components/shapes/AdminGraphicShape";
import { adminFetch } from "@/lib/adminFetch";
import { GRF_CHANNELS, GRF_PURPOSES_BY_CHANNEL } from "@shared/GRF_engine";
import type { GrfChannel } from "@shared/GRF_engine";
import type { GrfAsset } from "@/features/shared/components/skins/AdminGraphicSkins";

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

  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");

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

  const handleChannelChange = (ch: string) => {
    setFilterChannel(ch);
    setFilterPurpose("all");
  };

  const filtered = assets.filter((a) => {
    if (filterChannel !== "all" && a.channel !== filterChannel) return false;
    if (filterPurpose !== "all" && a.purpose !== filterPurpose)  return false;
    return true;
  });

  const availablePurposes = filterChannel !== "all"
    ? Object.entries(GRF_PURPOSES_BY_CHANNEL[filterChannel as GrfChannel] ?? {})
    : [];

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
      <Select value={filterChannel} onValueChange={handleChannelChange}>
        <SelectTrigger className="h-8 text-xs w-44" data-testid="select-filter-channel">
          <SelectValue placeholder="Channel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All channels</SelectItem>
          {(Object.entries(GRF_CHANNELS) as Array<[GrfChannel, typeof GRF_CHANNELS[GrfChannel]]>).map(([code, entry]) => (
            <SelectItem key={code} value={code} className="text-xs font-mono">
              {code} — {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filterPurpose}
        onValueChange={setFilterPurpose}
        disabled={filterChannel === "all"}
      >
        <SelectTrigger className="h-8 text-xs w-44" data-testid="select-filter-purpose">
          <SelectValue placeholder={filterChannel === "all" ? "Select channel first" : "Purpose"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All purposes</SelectItem>
          {availablePurposes.map(([code, entry]) => (
            <SelectItem key={code} value={code} className="text-xs font-mono">
              {code} — {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground ml-auto" data-testid="text-graphics-count">
        {filtered.length} / {assets.length}
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
      emptyMessage={assets.length === 0
        ? 'No graphics saved yet. Use "Save to Library" in the Products Builder.'
        : "No graphics match the current filters."}
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
