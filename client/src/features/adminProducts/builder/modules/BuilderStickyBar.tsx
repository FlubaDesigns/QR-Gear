import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBuilderContext } from "../BuilderContext";

export function BuilderStickyBar() {
  const { state } = useBuilderContext();

  if (!state.selectedProduct) return null;

  const { activeSessionId, sessionStatus } = state;
  const productTitle = state.selectedProduct.title;
  const brand = state.selectedProduct.brand;

  return (
    <div
      className="sticky top-0 z-50 -mx-0 px-3 py-2 bg-background/95 backdrop-blur border-b flex items-center justify-between gap-2 flex-wrap"
      data-testid="builder-sticky-bar"
    >
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium truncate leading-tight"
          data-testid="sticky-bar-product-title"
        >
          {productTitle}
        </p>
        {brand && (
          <p className="text-xs text-muted-foreground truncate leading-tight">
            {brand}
          </p>
        )}
      </div>

      <div className="flex-shrink-0">
        {activeSessionId === null && state.selectedProduct && (
          <Badge variant="outline" className="text-xs gap-1" data-testid="sticky-badge-starting">
            <Loader2 className="h-3 w-3 animate-spin" />
            Starting…
          </Badge>
        )}
        {activeSessionId && sessionStatus === "working" && (
          <Badge variant="outline" className="text-xs gap-1" data-testid="sticky-badge-working">
            <Clock className="h-3 w-3 text-amber-500" />
            In progress
          </Badge>
        )}
        {activeSessionId && sessionStatus === "artifact_ready" && (
          <Badge
            variant="outline"
            className="text-xs gap-1 border-green-500/40 text-green-700 dark:text-green-400"
            data-testid="sticky-badge-artifact-ready"
          >
            <CheckCircle2 className="h-3 w-3" />
            Packet ready
          </Badge>
        )}
        {activeSessionId && sessionStatus === "committed" && (
          <Badge
            variant="outline"
            className="text-xs gap-1 border-blue-500/40 text-blue-700 dark:text-blue-400"
            data-testid="sticky-badge-committed"
          >
            <CheckCircle2 className="h-3 w-3" />
            Saved
          </Badge>
        )}
      </div>
    </div>
  );
}
