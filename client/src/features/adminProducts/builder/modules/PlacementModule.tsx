import { MapPin, Check, QrCode, Image } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { getPlacementsForCategory, ALL_PLACEMENT_OPTIONS, QR_ONLY_PLACEMENTS, type PlacementId, type PlacementType } from "../types";

export function PlacementModule() {
  const { state, togglePlacement, setPlacementType } = useBuilderContext();
  
  if (!state.qrProductState || !state.selectedProduct) {
    return null;
  }

  // Get placements based on selected product category
  const category = state.category;
  const placementOptions = getPlacementsForCategory(category);
  
  const selectedCount = (state.selectedPlacements || []).length;
  const isQrPlus = state.qrProductState === "qr_plus";

  return (
    <CollapsibleModule
      title="Placement"
      icon={<MapPin className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isQrPlus 
            ? "Select placement locations and choose Graphic or QR for each spot."
            : "Select where to place your design. You can select multiple locations."
          }
        </p>
        
        <div className="space-y-3">
          {placementOptions.map((placement) => {
            const isSelected = (state.selectedPlacements || []).includes(placement.id);
            const placementType = state.placementConfig[placement.id] || "qr";
            const isQrOnly = QR_ONLY_PLACEMENTS.includes(placement.id);
            
            return (
              <div key={placement.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => togglePlacement(placement.id)}
                  className={`
                    w-full relative flex items-center justify-between gap-2 
                    min-h-[48px] px-4 py-3 rounded-lg border-2 
                    text-sm font-medium transition-all
                    ${isSelected 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                    }
                  `}
                  data-testid={`button-placement-${placement.id}`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <Check className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{placement.label}</span>
                  </div>
                  {isSelected && isQrPlus && (
                    <span className="text-xs px-2 py-1 rounded bg-muted">
                      {placementType === "qr" ? "QR Code" : "Graphic"}
                    </span>
                  )}
                </button>
                
                {/* Show Graphic/QR toggle for QR Plus when placement is selected (except QR-only placements) */}
                {isSelected && isQrPlus && !isQrOnly && (
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      variant={placementType === "graphic" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPlacementType(placement.id, "graphic")}
                      className="flex-1"
                      data-testid={`placement-type-graphic-${placement.id}`}
                    >
                      <Image className="h-4 w-4 mr-2" />
                      Graphic
                    </Button>
                    <Button
                      type="button"
                      variant={placementType === "qr" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPlacementType(placement.id, "qr")}
                      className="flex-1"
                      data-testid={`placement-type-qr-${placement.id}`}
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      QR Code
                    </Button>
                  </div>
                )}
                {/* Show QR Only indicator for shoulder placements */}
                {isSelected && isQrPlus && isQrOnly && (
                  <div className="ml-4 text-xs text-muted-foreground flex items-center gap-1">
                    <QrCode className="h-3 w-3" />
                    This placement only supports QR codes
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedCount > 0 && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm font-medium">
              {selectedCount} placement{selectedCount > 1 ? "s" : ""} selected
            </p>
            {isQrPlus && (
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                {(state.selectedPlacements || []).map(p => {
                  const label = ALL_PLACEMENT_OPTIONS.find(opt => opt.id === p)?.label;
                  const type = state.placementConfig[p] || "qr";
                  return (
                    <p key={p}>
                      <span className="font-medium">{label}:</span>{" "}
                      {type === "qr" ? "QR Code" : "Graphic"}
                    </p>
                  );
                })}
              </div>
            )}
            {!isQrPlus && (
              <p className="text-xs text-muted-foreground mt-1">
                {(state.selectedPlacements || []).map(p => 
                  ALL_PLACEMENT_OPTIONS.find(opt => opt.id === p)?.label
                ).join(", ")}
              </p>
            )}
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
