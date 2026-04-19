import { useState } from "react";
import { Loader2, CheckCircle2, Clock, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { useCollapseAll } from "@/features/shared/components/CollapsibleModule";

export function BuilderStickyBar() {
  const { state } = useBuilderContext();
  const { collapseAll, expandAll } = useCollapseAll();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!state.selectedProduct) return null;

  const { activeSessionId, sessionStatus } = state;
  const productTitle = state.selectedProduct.title;
  const brand = state.selectedProduct.brand;

  const handleToggle = () => {
    if (isCollapsed) {
      expandAll();
      setIsCollapsed(false);
    } else {
      collapseAll();
      setIsCollapsed(true);
    }
  };

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

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          data-testid="button-collapse-all"
          className="text-xs text-muted-foreground gap-1.5"
        >
          {isCollapsed ? (
            <>
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Expand All
            </>
          ) : (
            <>
              <ChevronsDownUp className="h-3.5 w-3.5" />
              Collapse All
            </>
          )}
        </Button>

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
