import { MapPin, Check, QrCode, Image, Palette, AlertCircle, Loader2, Printer } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { QR_ONLY_PLACEMENTS, BRANDING_PLACEMENTS, type PlacementSize, type ProductColor, type PlacementMethodOption } from "../types";

const SIZE_OPTIONS: { value: PlacementSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

const METHOD_LABELS: Record<string, string> = {
  dtg: "DTG",
  dtf: "DTF",
};

const METHOD_DESCRIPTIONS: Record<string, string> = {
  dtg: "Direct-to-Garment (ink on fabric)",
  dtf: "Direct-to-Film (heat transfer, more vibrant)",
};

export function PlacementModule() {
  const { state, togglePlacement, setPlacementType, setPlacementSize, setPlacementMethod, setSelectedColor } = useBuilderContext();
  
  if (!state.qrProductState || !state.selectedProduct) {
    return null;
  }

  const productPlacements = state.selectedProduct.placements;
  const hasApiPlacements = productPlacements && productPlacements.length > 0;
  const isLoading = state.placementsLoading;
  
  const allPlacementOptions = hasApiPlacements
    ? productPlacements.map(p => ({
        id: p.id || p.type,
        label: p.title || p.id?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        additionalPrice: p.additionalPrice || 0,
        methods: p.methods || [] as PlacementMethodOption[],
      }))
    : [];
  
  const placementOptions = allPlacementOptions.filter(
    p => !(BRANDING_PLACEMENTS as string[]).includes(p.id)
  );
  const hasBrandingPlacement = allPlacementOptions.some(
    p => (BRANDING_PLACEMENTS as string[]).includes(p.id)
  );
  
  const selectedPlacements = state.selectedPlacements || [];
  const placementConfig = state.placementConfig || {};
  const placementSizes = state.placementSizes || {};
  const selectedCount = selectedPlacements.length;
  const isQrBasics = state.qrProductState === "qr_basics";
  // Graphic toggle for Plus/Canvas/Play/Dynamics - NOT for Basics
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
        
        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading placements from {state.selectedProduct.fulfillmentProvider || 'provider'}...</span>
          </div>
        )}
        
        {!isLoading && hasApiPlacements && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" />
            <span>{placementOptions.length} placement{placementOptions.length !== 1 ? 's' : ''} from {state.selectedProduct.fulfillmentProvider || 'provider'}</span>
          </div>
        )}
        
        {!isLoading && !hasApiPlacements && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            <span>No placements found from printer — this product may not support custom printing</span>
          </div>
        )}
        
        {!isLoading && hasBrandingPlacement && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <QrCode className="h-3 w-3" />
            <span>QR Gear neck tag auto-included on this product</span>
          </div>
        )}
        
        <div className="space-y-3">
          {placementOptions.map((placement) => {
            const isSelected = selectedPlacements.includes(placement.id);
            const placementType = placementConfig[placement.id] || "qr";
            const placementSize = placementSizes[placement.id] || "medium";
            const isQrOnly = (QR_ONLY_PLACEMENTS as string[]).includes(placement.id);
            const hasMethods = placement.methods && placement.methods.length > 1;
            const selectedMethod = state.placementMethods[placement.id] || (placement.methods?.[0]?.method ?? 'dtg');
            
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

                    {placement.methods && placement.methods.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Printer className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Print Method:</span>
                        </div>
                        {hasMethods ? (
                          <div className="flex gap-2">
                            {placement.methods.map((m) => (
                              <Button
                                key={m.method}
                                type="button"
                                variant={selectedMethod === m.method ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPlacementMethod(placement.id, m.method)}
                                className="flex-1"
                                data-testid={`placement-method-${m.method}-${placement.id}`}
                              >
                                {METHOD_LABELS[m.method] || m.method.toUpperCase()}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {METHOD_LABELS[placement.methods[0].method] || placement.methods[0].method.toUpperCase()} only
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {METHOD_DESCRIPTIONS[selectedMethod] || ''}
                        </p>
                      </div>
                    )}
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
                const placement = placementOptions.find(opt => opt.id === p);
                const label = placement?.label || p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const type = placementConfig[p] || "qr";
                const size = placementSizes[p] || "medium";
                const method = state.placementMethods[p];
                const methodLabel = method ? (METHOD_LABELS[method] || method.toUpperCase()) : null;
                return (
                  <p key={p}>
                    <span className="font-medium">{label}:</span>{" "}
                    {showPlacementTypeToggle ? (type === "qr" ? "QR Code" : "Graphic") + " • " : ""}
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                    {methodLabel ? ` • ${methodLabel}` : ""}
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
