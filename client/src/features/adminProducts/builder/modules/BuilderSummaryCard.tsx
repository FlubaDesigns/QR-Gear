import { useBuilderContext } from "../BuilderContext";
import { QR_PRODUCT_STATES } from "../types";
import { CheckCircle2, Circle, AlertTriangle, Loader2, Clock } from "lucide-react";
import type { BuilderState } from "../types";

type SectionStatus = "complete" | "partial" | "missing";

function getSectionStatuses(state: BuilderState, autoSaveFailed: boolean) {
  const product: SectionStatus =
    state.selectedProduct && state.qrProductState ? "complete" :
    state.selectedProduct ? "partial" : "missing";

  const hasDesign = !!(
    state.content?.graphicLayoutMode ||
    state.loadedTemplate ||
    state.loadedGraphic ||
    state.loadedBackground
  );
  const design: SectionStatus = hasDesign ? "complete" : state.selectedProduct ? "partial" : "missing";

  const hasQRContent = (() => {
    const c = state.content;
    const mode = state.qrProductState;
    if (!c) return false;
    if (mode === "qr_play") return !!(c.playMediaSource || c.playMediaUrl);
    if (mode === "qr_compose") return !!(c.composeMode);
    return !!(c.url);
  })();
  const qr: SectionStatus = hasQRContent ? "complete" : state.selectedProduct ? "partial" : "missing";

  const layout: SectionStatus =
    (state.selectedPlacements?.length || 0) > 0 ? "complete" :
    state.selectedProduct ? "partial" : "missing";

  const { sessionStatus } = state;
  const output: SectionStatus =
    (sessionStatus === "artifact_ready" || sessionStatus === "committed") ? "complete" :
    state.activePacketId ? "partial" : "missing";

  return { product, design, qr, layout, output };
}

interface StatusDotProps {
  label: string;
  status: SectionStatus;
}

function StatusDot({ label, status }: StatusDotProps) {
  const icon =
    status === "complete" ? <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" /> :
    status === "partial" ? <Circle className="h-3 w-3 text-amber-500" /> :
    <AlertTriangle className="h-3 w-3 text-muted-foreground/60" />;

  return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground" data-testid={`status-section-${label.toLowerCase().replace(/ /g, '-')}`}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

export function BuilderSummaryCard() {
  const { state, autoSaveFailed, selectedStore, selectedChannel, selectedCollection } =
    useBuilderContext();

  const statuses = getSectionStatuses(state, autoSaveFailed);
  const { sessionStatus } = state;

  const sessionBadge = (() => {
    if (autoSaveFailed)
      return <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /> Save failed</span>;
    if (!state.activeSessionId && state.selectedProduct)
      return <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Starting…</span>;
    if (sessionStatus === "working")
      return <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400"><Clock className="h-3 w-3" /> In progress</span>;
    if (sessionStatus === "artifact_ready")
      return <span className="inline-flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400"><CheckCircle2 className="h-3 w-3" /> Packet ready</span>;
    if (sessionStatus === "committed")
      return <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-400"><CheckCircle2 className="h-3 w-3" /> Saved</span>;
    return null;
  })();

  const product = state.selectedProduct;
  const qrLabel = QR_PRODUCT_STATES.find(s => s.id === state.qrProductState)?.label;
  const locationParts = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name].filter(Boolean);

  return (
    <div className="px-3 py-2 bg-muted/40 border-b" data-testid="builder-summary-card">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {product?.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-7 w-7 rounded-sm object-cover flex-shrink-0 border"
              data-testid="img-summary-hero"
            />
          )}
          <div className="min-w-0">
            {product ? (
              <p className="text-xs font-medium truncate leading-tight" data-testid="text-summary-product-title">
                {product.title}
                {qrLabel && <span className="ml-1.5 text-muted-foreground font-normal">· {qrLabel}</span>}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground" data-testid="text-summary-product-title">No product selected</p>
            )}
            {locationParts.length > 0 && (
              <p className="text-[10px] text-muted-foreground truncate leading-tight" data-testid="text-summary-location">
                {locationParts.join(" / ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">{sessionBadge}</div>
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap" data-testid="section-status-row">
        <StatusDot label="Product" status={statuses.product} />
        <StatusDot label="Design" status={statuses.design} />
        <StatusDot label="QR" status={statuses.qr} />
        <StatusDot label="Layout" status={statuses.layout} />
        <StatusDot label="Output" status={statuses.output} />
      </div>
    </div>
  );
}
