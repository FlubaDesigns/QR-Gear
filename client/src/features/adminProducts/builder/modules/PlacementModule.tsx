import { MapPin, Check } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { PLACEMENT_OPTIONS, type PlacementId } from "../types";

export function PlacementModule() {
  const { state, togglePlacement } = useBuilderContext();
  
  if (!state.qrProductState || !state.selectedProduct) {
    return null;
  }

  const selectedCount = state.selectedPlacements.length;

  return (
    <CollapsibleModule
      title="Placement"
      icon={<MapPin className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select where to place your design. You can select multiple locations.
        </p>
        
        <div className="grid grid-cols-2 gap-3">
          {PLACEMENT_OPTIONS.map((placement) => {
            const isSelected = state.selectedPlacements.includes(placement.id);
            return (
              <button
                key={placement.id}
                type="button"
                onClick={() => togglePlacement(placement.id)}
                className={`
                  relative flex items-center justify-center gap-2 
                  min-h-[48px] px-4 py-3 rounded-lg border-2 
                  text-sm font-medium transition-all
                  ${isSelected 
                    ? "border-primary bg-primary/10 text-primary" 
                    : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
                data-testid={`button-placement-${placement.id}`}
              >
                {isSelected && (
                  <Check className="h-4 w-4 flex-shrink-0" />
                )}
                <span>{placement.label}</span>
              </button>
            );
          })}
        </div>

        {selectedCount > 0 && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm font-medium">
              {selectedCount} placement{selectedCount > 1 ? "s" : ""} selected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {state.selectedPlacements.map(p => 
                PLACEMENT_OPTIONS.find(opt => opt.id === p)?.label
              ).join(", ")}
            </p>
          </div>
        )}

        {selectedCount === 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Please select at least one placement location.
          </p>
        )}
      </div>
    </CollapsibleModule>
  );
}
