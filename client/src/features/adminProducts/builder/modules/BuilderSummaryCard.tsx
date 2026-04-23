import { Badge } from "@/components/ui/badge";
import { useBuilderContext } from "../BuilderContext";
import { QR_PRODUCT_STATES } from "../types";
import { CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";

const STATE_COLORS: Record<string, string> = {
  qr_basics: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  qr_plus: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  qr_canvas: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  qr_play: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  qr_compose: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export function BuilderSummaryCard() {
  const { state, autoSaveFailed, selectedStore, selectedChannel, selectedCollection } =
    useBuilderContext();

  if (!state.selectedProduct) return null;

  const product = state.selectedProduct;
  const heroImage = product.imageUrl || null;

  const qrLabel = QR_PRODUCT_STATES.find(s => s.id === state.qrProductState)?.label;
  const qrColorClass = state.qrProductState ? STATE_COLORS[state.qrProductState] ?? "" : "";

  const { sessionStatus } = state;

  const statusBadge = (() => {
    if (autoSaveFailed)
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" /> Save failed
        </span>
      );
    if (!state.activeSessionId && state.selectedProduct)
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Starting…
        </span>
      );
    if (sessionStatus === "working")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3" /> In progress
        </span>
      );
    if (sessionStatus === "artifact_ready")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" /> Packet ready
        </span>
      );
    if (sessionStatus === "committed")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400">
          <CheckCircle2 className="h-3 w-3" /> Saved
        </span>
      );
    return null;
  })();

  const locationParts = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name].filter(Boolean);

  return (
    <div
      className="mx-0 px-3 py-2.5 bg-muted/40 border-b flex items-center gap-3"
      data-testid="builder-summary-card"
    >
      {heroImage && (
        <img
          src={heroImage}
          alt={product.title}
          className="h-10 w-10 rounded-md object-cover flex-shrink-0 border"
          data-testid="img-summary-hero"
        />
      )}

      <div className="flex-1 min-w-0 space-y-0.5">
        <p
          className="text-sm font-medium truncate leading-tight"
          data-testid="text-summary-product-title"
        >
          {product.title}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          {qrLabel && (
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0 text-[11px] font-medium ${qrColorClass}`}
              data-testid="badge-summary-qr-type"
            >
              {qrLabel}
            </span>
          )}
          {locationParts.length > 0 && (
            <span
              className="text-[11px] text-muted-foreground truncate"
              data-testid="text-summary-location"
            >
              {locationParts.join(" / ")}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0">{statusBadge}</div>
    </div>
  );
}
