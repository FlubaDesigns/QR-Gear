import { MapPin, Check, QrCode, Image, Palette, AlertCircle } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { getPlacementsForCategory, ALL_PLACEMENT_OPTIONS, QR_ONLY_PLACEMENTS, type PlacementId, type PlacementType, type PlacementSize, type ProductColor, type ProductPlacement } from "../types";

const SIZE_OPTIONS: { value: PlacementSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

// Map provider placement IDs to our internal placement system
function mapProviderPlacement(providerPlacement: ProductPlacement): { id: PlacementId; label: string } {
  const type = (providerPlacement.type || providerPlacement.id || '').toLowerCase().replace(/-/g, '_');
  
  // Map common Printful/Printify placement types to our system
  const mappings: Record<string, { id: PlacementId; label: string }> = {
    'front': { id: 'front-center', label: 'Front Center' },
    'front_large': { id: 'front-center', label: 'Front (Large)' },
    'front_small': { id: 'front-chest', label: 'Front Chest' },
    'back': { id: 'back', label: 'Back' },
    'back_large': { id: 'back', label: 'Back (Large)' },
    'left_chest': { id: 'front-chest', label: 'Left Chest' },
    'right_chest': { id: 'front-chest', label: 'Right Chest' },
    'left_sleeve': { id: 'left-shoulder', label: 'Left Sleeve' },
    'right_sleeve': { id: 'right-shoulder', label: 'Right Sleeve' },
    'pocket': { id: 'pocket', label: 'Pocket' },
    'sleeve_left': { id: 'left-shoulder', label: 'Left Sleeve' },
    'sleeve_right': { id: 'right-shoulder', label: 'Right Sleeve' },
    // Mugs
    'mug_wrap': { id: 'mug-wrap', label: 'Wrap Around' },
    'mug_front': { id: 'mug-front', label: 'Front' },
    'mug_back': { id: 'mug-back', label: 'Back' },
    // Hats
    'embroidery_front': { id: 'hat-front', label: 'Front' },
    'embroidery_back': { id: 'hat-back', label: 'Back' },
    'embroidery_left': { id: 'hat-side', label: 'Left Side' },
    'embroidery_right': { id: 'hat-side', label: 'Right Side' },
  };
  
  if (mappings[type]) {
    return mappings[type];
  }
  
  // If no mapping found, create a reasonable default
  return {
    id: type as PlacementId,
    label: providerPlacement.title || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  };
}

export function PlacementModule() {
  const { state, togglePlacement, setPlacementType, setPlacementSize, setSelectedColor } = useBuilderContext();
  
  if (!state.qrProductState || !state.selectedProduct) {
    return null;
  }

  const category = state.category;
  
  // Use actual product placements from API if available, otherwise fall back to category-based
  const productPlacements = state.selectedProduct.placements;
  const hasApiPlacements = productPlacements && productPlacements.length > 0;
  
  const placementOptions = hasApiPlacements
    ? productPlacements.map(p => {
        const mapped = mapProviderPlacement(p);
        return { id: mapped.id, label: mapped.label, additionalPrice: p.additionalPrice };
      })
    : getPlacementsForCategory(category);
  
  const selectedPlacements = state.selectedPlacements || [];
  const placementConfig = state.placementConfig || {};
  const placementSizes = state.placementSizes || {};
  const selectedCount = selectedPlacements.length;
  const isQrBasics = state.qrProductState === "qr_basics";
  const showPlacementTypeToggle = !isQrBasics;
  
  const availableColors: ProductColor[] = state.selectedProduct?.availableColors || [];
  const selectedColor = state.selectedColor;

  return (
    <CollapsibleModule
      title="Placement"
      icon={<MapPin className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {availableColors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Shirt Background Color</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableColors.slice(0, 12).map((color) => {
                const isSelected = selectedColor?.hex === color.hex;
                return (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`
                      w-10 h-10 rounded-lg border-2 transition-all
                      ${isSelected 
                        ? "border-primary ring-2 ring-primary/30 scale-110" 
                        : "border-border hover:border-primary/50 hover:scale-105"
                      }
                    `}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                    data-testid={`swatch-${color.name.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                );
              })}
              {availableColors.length > 12 && (
                <span className="text-xs text-muted-foreground self-center ml-1">
                  +{availableColors.length - 12} more
                </span>
              )}
            </div>
            {selectedColor && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium">{selectedColor.name}</span>
              </p>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {showPlacementTypeToggle 
            ? "Select placement locations, choose Graphic or QR, and pick the size for each spot."
            : "Select where to place your design and pick the size. You can select multiple locations."
          }
        </p>
        
        {hasApiPlacements && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" />
            <span>Placements from {state.selectedProduct.fulfillmentProvider || 'provider'} catalog</span>
          </div>
        )}
        
        {!hasApiPlacements && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            <span>Using default placements for {category || 'this category'}</span>
          </div>
        )}
        
        <div className="space-y-3">
          {placementOptions.map((placement) => {
            const isSelected = selectedPlacements.includes(placement.id);
            const placementType = placementConfig[placement.id] || "qr";
            const placementSize = placementSizes[placement.id] || "medium";
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
                  {isSelected && (
                    <div className="flex items-center gap-2">
                      {showPlacementTypeToggle && (
                        <span className="text-xs px-2 py-1 rounded bg-muted">
                          {placementType === "qr" ? "QR" : "Graphic"}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded bg-primary/20 font-bold">
                        {placementSize.toUpperCase()}
                      </span>
                    </div>
                  )}
                </button>
                
                {isSelected && (
                  <div className="ml-4 space-y-2">
                    {showPlacementTypeToggle && !isQrOnly && (
                      <div className="flex gap-2">
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
                    
                    {showPlacementTypeToggle && isQrOnly && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <QrCode className="h-3 w-3" />
                        This placement only supports QR codes
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Size:</span>
                      <div className="flex gap-1">
                        {SIZE_OPTIONS.map((size) => (
                          <Button
                            key={size.value}
                            type="button"
                            variant={placementSize === size.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPlacementSize(placement.id, size.value)}
                            className="w-10 h-8 px-0"
                            data-testid={`placement-size-${size.value}-${placement.id}`}
                          >
                            {size.label}
                          </Button>
                        ))}
                      </div>
                    </div>
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
            <div className="text-xs text-muted-foreground mt-2 space-y-1">
              {selectedPlacements.map(p => {
                const label = ALL_PLACEMENT_OPTIONS.find(opt => opt.id === p)?.label;
                const type = placementConfig[p] || "qr";
                const size = placementSizes[p] || "medium";
                return (
                  <p key={p}>
                    <span className="font-medium">{label}:</span>{" "}
                    {showPlacementTypeToggle ? (type === "qr" ? "QR Code" : "Graphic") + " • " : ""}
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </p>
                );
              })}
            </div>
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
