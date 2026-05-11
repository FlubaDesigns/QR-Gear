import { useState } from "react";
import { MapPin, Check, QrCode, Image, Palette, AlertCircle, Loader2, Printer, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { useBuilderContext } from "../BuilderContext";
import { useIsMobile } from "@/hooks/use-mobile";
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

export function ColorSection({
  availableColors,
  selectedColor,
  onSelect,
}: {
  availableColors: ProductColor[];
  selectedColor: { name: string; hex: string } | null;
  onSelect: (color: ProductColor) => void;
}) {
  const [open, setOpen] = useState(false);

  if (availableColors.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen(o => !o)}
        data-testid="button-color-accordion"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <Palette className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium flex-1">Background Color</span>
        {selectedColor && (
          <span className="flex items-center gap-1.5 flex-shrink-0">
            <span
              className="inline-block w-4 h-4 rounded-sm border border-border"
              style={{ backgroundColor: selectedColor.hex }}
            />
            <span className="text-xs text-muted-foreground">{selectedColor.name}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t">
          <div className="overflow-x-auto -mx-1 pb-1">
            <div className="flex gap-2 px-1 w-max">
              {availableColors.map((color) => {
                const isSelected = selectedColor?.hex === color.hex;
                return (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => onSelect(color)}
                    className={`
                      w-9 h-9 rounded-md border-2 flex-shrink-0 transition-all
                      ${isSelected
                        ? "border-primary ring-2 ring-primary/30 scale-110"
                        : "border-border hover:border-primary/50"
                      }
                    `}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                    data-testid={`swatch-${color.name.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {availableColors.length} colors — swipe to see all
          </p>
        </div>
      )}
    </div>
  );
}

export function PlacementModule() {
  const { state, togglePlacement, setPlacementType, setPlacementSize, setPlacementMethod, setSelectedColor, refreshPlacements } = useBuilderContext();
  const isMobile = useIsMobile();

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
  const showPlacementTypeToggle = !isQrBasics;

  const availableColors: ProductColor[] = state.selectedProduct?.availableColors || [];
  const selectedColor = state.selectedColor;

  const badge = selectedCount > 0 ? (
    <Badge variant="secondary" className="text-xs">
      {selectedCount} placement{selectedCount !== 1 ? "s" : ""}
    </Badge>
  ) : null;

  return (
    <CollapsibleModule
      title="Placement"
      icon={<MapPin className="h-4 w-4" />}
      badge={badge}
      className="bg-muted/30"
      defaultOpen={!isMobile}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {showPlacementTypeToggle
            ? "Select placement locations, choose Graphic or QR, and pick the size for each spot."
            : "Select where to place your design and pick the size."
          }
        </p>

        {isLoading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading print locations from QRG catalog...</span>
          </div>
        )}

        {!isLoading && state.placementsError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{state.placementsError} — placements defaulted to standard.</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-auto py-0 px-1 text-xs text-destructive"
              onClick={refreshPlacements}
              data-testid="button-refresh-placements-error"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {!isLoading && state.placementsRestoreWarning && (
          <div className="flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" data-testid="banner-placements-restore-warning">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{state.placementsRestoreWarning}</span>
          </div>
        )}

        {!isLoading && hasApiPlacements && (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              <span className="flex-1">{placementOptions.length} placement{placementOptions.length !== 1 ? 's' : ''} from {state.selectedProduct.fulfillmentProvider || 'provider'}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-auto py-0 px-1 text-xs text-muted-foreground"
                onClick={refreshPlacements}
                data-testid="button-refresh-placements"
                title="Reload placements from provider"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            {state.selectedProduct.layoutSource && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground pl-4" data-testid="text-layout-source">
                <span>
                  {state.selectedProduct.layoutSource === 'provider_product_locations'
                    ? `Source: ${state.selectedProduct.fulfillmentProvider || 'provider'} product catalog${state.selectedProduct.providerProductId ? ` (ID ${state.selectedProduct.providerProductId})` : ''}`
                    : state.selectedProduct.layoutSource === 'legacy_printPositions'
                      ? 'Source: cached print positions (may be stale)'
                      : state.selectedProduct.layoutSource === 'emergency_fallback'
                        ? 'Source: fallback (front only)'
                        : state.selectedProduct.layoutSource}
                </span>
              </div>
            )}
          </div>
        )}

        {!isLoading && !hasApiPlacements && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            <span className="flex-1">No placements found from printer — this product may not support custom printing</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-auto py-0 px-1 text-xs text-muted-foreground"
              onClick={refreshPlacements}
              data-testid="button-refresh-placements-empty"
              title="Reload placements from provider"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
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
                    {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
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
