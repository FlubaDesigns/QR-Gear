import { useState, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Layers, ImageIcon, X, ChevronLeft, ChevronRight, Tag, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollGridView } from "@/features/shared/components/views/ScrollGridView";
import { ModalView } from "@/features/shared/components/views/ModalView";
import { adminFetch } from "@/lib/adminFetch";
import { isValidGrfId, GRF_CHANNELS, GRF_PURPOSES_BY_CHANNEL } from "@shared/graphicCodes";
import type { GrfChannel } from "@shared/graphicCodes";
import type { GrfAsset } from "../shared/types";

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

// ── Label helpers ─────────────────────────────────────────────────────────────

function isValidMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function resolveChannelLabel(channel: string): { label: string; valid: boolean } {
  const entry = GRF_CHANNELS[channel as GrfChannel];
  return entry ? { label: entry.label, valid: true } : { label: channel || "—", valid: false };
}

function resolvePurposeLabel(channel: string, purpose: string): { label: string; valid: boolean } {
  const entry = GRF_PURPOSES_BY_CHANNEL[channel as GrfChannel]?.[purpose];
  return entry ? { label: entry.label, valid: true } : { label: purpose || "—", valid: false };
}

function MissingBadge({ text }: { text: string }) {
  return (
    <Badge variant="destructive" className="text-xs gap-1 font-mono">
      <AlertTriangle className="h-3 w-3" />
      {text}
    </Badge>
  );
}

// ── GraphicCard ───────────────────────────────────────────────────────────────

function GraphicCard({
  asset,
  onClick,
  onArchive,
}: {
  asset: GrfAsset;
  onClick: () => void;
  onArchive: (id: string) => void;
}) {
  const channelResult = resolveChannelLabel(asset.channel);
  const purposeResult = resolvePurposeLabel(asset.channel, asset.purpose);
  const idValid       = isValidGrfId(asset.grfId);
  const mimeValid     = isValidMime(asset.mimeType);
  const hasWarning    = !channelResult.valid || !purposeResult.valid || !idValid || !mimeValid;

  return (
    <div
      className="group relative cursor-pointer rounded-md overflow-hidden border bg-card hover-elevate transition-all"
      onClick={onClick}
      data-testid={`card-graphic-${asset.id}`}
    >
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {asset.publicUrl ? (
          <img
            src={asset.publicUrl}
            alt={asset.name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <ImageIcon className="h-10 w-10 text-muted-foreground opacity-40" />
        )}
      </div>

      <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
        {asset.grfId && (
          <Badge className={`text-xs font-mono px-1.5 py-0.5 ${idValid ? "bg-background/90 text-foreground border" : "bg-destructive/90 text-destructive-foreground border-destructive"}`}>
            {asset.grfId}
          </Badge>
        )}
        {hasWarning && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0.5 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Schema
          </Badge>
        )}
      </div>

      <button
        type="button"
        className="absolute top-1.5 right-1.5 p-1 rounded-md bg-background/80 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors invisible group-hover:visible"
        onClick={(e) => { e.stopPropagation(); onArchive(asset.id); }}
        data-testid={`button-archive-graphic-${asset.id}`}
        title="Archive"
        aria-label="Archive graphic"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="p-2 space-y-0.5">
        <p className="text-xs font-medium truncate" title={asset.name} data-testid={`text-graphic-name-${asset.id}`}>
          {asset.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {channelResult.valid ? channelResult.label : <span className="text-destructive font-semibold">MISSING CHANNEL</span>}
          {" · "}
          {purposeResult.valid ? purposeResult.label : <span className="text-destructive font-semibold">MISSING PURPOSE</span>}
        </p>
      </div>
    </div>
  );
}

// ── GraphicDetailPanel ────────────────────────────────────────────────────────

function GraphicDetailPanel({
  asset,
  onArchive,
  isArchiving,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  asset: GrfAsset;
  onArchive: () => void;
  isArchiving: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const channelResult = resolveChannelLabel(asset.channel);
  const purposeResult = resolvePurposeLabel(asset.channel, asset.purpose);
  const idValid       = isValidGrfId(asset.grfId);
  const mimeValid     = isValidMime(asset.mimeType);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" data-testid="text-detail-graphic-name">{asset.name}</p>
          {asset.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{asset.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {channelResult.valid
            ? <Badge variant="secondary" className="text-xs">{channelResult.label}</Badge>
            : <MissingBadge text="MISSING CHANNEL" />
          }
          {purposeResult.valid
            ? <Badge variant="outline" className="text-xs">{purposeResult.label}</Badge>
            : <MissingBadge text="MISSING PURPOSE" />
          }
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Tag className="h-3.5 w-3.5 flex-shrink-0" />
          <span className={`font-mono select-all ${idValid ? "" : "text-destructive font-semibold"}`} data-testid="text-detail-graphic-id">
            {asset.grfId}
          </span>
          {!idValid && <MissingBadge text="INVALID ID" />}
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-mono">{asset.mimeType}</span>
          {!mimeValid && <MissingBadge text="INVALID MIME" />}
        </div>

        {(asset.channel || asset.purpose) && (
          <div className="text-muted-foreground">
            Ch: <span className="font-mono">{asset.channel}</span>
            {" · "}
            P: <span className="font-mono">{asset.purpose}</span>
          </div>
        )}

        {asset.originalFilename && (
          <div className="text-muted-foreground">
            File: <span className="font-mono select-all">{asset.originalFilename}</span>
          </div>
        )}

        {asset.sourceGrfId && (
          <div className="text-muted-foreground">
            Source: <span className="font-mono select-all">{asset.sourceGrfId}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={onPrev} disabled={!hasPrev} data-testid="button-detail-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNext} disabled={!hasNext} data-testid="button-detail-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={onArchive} disabled={isArchiving} data-testid="button-detail-archive">
            {isArchiving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Archive
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-detail-close">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── GraphicsTabInner ──────────────────────────────────────────────────────────

function GraphicsTabInner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showConfirm, setShowConfirm]     = useState(false);
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
      setSelectedIndex(null);
      toast({ title: "Archived", description: "Graphic removed from library" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive graphic", variant: "destructive" });
    },
  });

  // When channel filter changes, reset purpose filter
  const handleChannelChange = (ch: string) => {
    setFilterChannel(ch);
    setFilterPurpose("all");
    setSelectedIndex(null);
  };

  const filtered = assets.filter((a) => {
    if (filterChannel !== "all" && a.channel !== filterChannel) return false;
    if (filterPurpose !== "all" && a.purpose !== filterPurpose)  return false;
    return true;
  });

  // Available purposes for the currently-selected channel filter
  const availablePurposes = filterChannel !== "all"
    ? Object.entries(GRF_PURPOSES_BY_CHANNEL[filterChannel as GrfChannel] ?? {})
    : [];

  const selectedAsset = selectedIndex !== null ? filtered[selectedIndex] : null;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < filtered.length - 1;

  const handlePrev  = () => { if (hasPrev) setSelectedIndex(selectedIndex! - 1); };
  const handleNext  = () => { if (hasNext) setSelectedIndex(selectedIndex! + 1); };
  const handleClose = () => setSelectedIndex(null);

  const handleArchive = (id: string) => {
    archiveMutation.mutate(id);
    setShowConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-graphics">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3" data-testid="error-graphics">
        <p className="text-sm font-semibold text-destructive">Failed to load graphics</p>
        <p className="text-xs text-destructive/80 mt-0.5">{(error as Error)?.message ?? "Unknown error"}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg">
        <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground text-sm" data-testid="text-no-graphics">
          No graphics saved yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use "Save to Library" in the Products Builder to add graphics here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
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
          onValueChange={(v) => { setFilterPurpose(v); setSelectedIndex(null); }}
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

      {filtered.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">No graphics match the current filters.</p>
        </div>
      ) : (
        <ScrollGridView
          items={filtered.map((a) => ({ id: a.id, name: a.name }))}
          columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          height="auto"
          emptyMessage="No graphics to display."
          emptyIcon={<Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
          footer={null}
          renderItem={(_, index) => (
            <GraphicCard
              asset={filtered[index]}
              onClick={() => setSelectedIndex(index)}
              onArchive={(id) => { setSelectedIndex(index); setShowConfirm(true); void id; }}
            />
          )}
        />
      )}

      <ModalView
        open={selectedIndex !== null}
        onOpenChange={(open) => !open && handleClose()}
        title={selectedAsset?.name ?? "Graphic Preview"}
        showCloseButton={false}
      >
        <div className="relative">
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70"
            onClick={handleClose}
            data-testid="button-gallery-close"
          >
            <X className="h-5 w-5 text-white" />
          </Button>

          <div className="relative aspect-square sm:aspect-video bg-muted flex items-center justify-center overflow-hidden">
            {selectedAsset?.publicUrl ? (
              <img
                src={selectedAsset.publicUrl}
                alt={selectedAsset.name}
                className="max-w-full max-h-full object-contain"
                data-testid="img-gallery-preview"
              />
            ) : (
              <ImageIcon className="h-24 w-24 text-muted-foreground" />
            )}

            {hasPrev && (
              <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={handlePrev} data-testid="button-gallery-prev">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {hasNext && (
              <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={handleNext} data-testid="button-gallery-next">
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}

            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {(selectedIndex ?? 0) + 1} / {filtered.length}
            </div>
          </div>

          {selectedAsset && (
            <GraphicDetailPanel
              asset={selectedAsset}
              onArchive={() => setShowConfirm(true)}
              isArchiving={archiveMutation.isPending}
              onClose={handleClose}
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          )}
        </div>
      </ModalView>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this graphic?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the graphic from your library. The underlying image file is not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAsset && handleArchive(selectedAsset.id)}
              data-testid="button-confirm-action"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function GraphicsTab() {
  return (
    <GraphicsBoundary>
      <GraphicsTabInner />
    </GraphicsBoundary>
  );
}
