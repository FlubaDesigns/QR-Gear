import { Check, MapPin, QrCode, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QR_ONLY_PLACEMENTS } from "@/features/adminProducts/builder/types";

export type PlacementSize = 'small' | 'medium' | 'large';
export type PlacementType = 'qr' | 'graphic';

export interface Placement {
  id: string;
  title: string;
}

export interface PlacementPickerProps {
  placements: Placement[];
  selectedPlacement: string;
  onSelect: (placementId: string) => void;
  placementSize: PlacementSize;
  onSizeChange: (size: PlacementSize) => void;
  placementType?: PlacementType;
  onTypeChange?: (type: PlacementType) => void;
  showTypeToggle?: boolean;
  qrOnlyPlacements?: string[];
  productTitle?: string;
  title?: string;
  subtitle?: string;
}

const SIZE_OPTIONS: { value: PlacementSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

export function PlacementPicker({
  placements,
  selectedPlacement,
  onSelect,
  placementSize,
  onSizeChange,
  placementType = 'qr',
  onTypeChange,
  showTypeToggle = true,
  qrOnlyPlacements = QR_ONLY_PLACEMENTS,
  productTitle,
  title = "Pick Location",
  subtitle,
}: PlacementPickerProps) {
  if (placements.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-slate-400">Where do you want your design?</p>
        </div>
        <div className="text-center py-8 text-amber-400">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No placement options available for this product</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400">
          {subtitle || (productTitle ? `Where do you want your design on the ${productTitle}?` : "Where do you want your design?")}
        </p>
      </div>

      <div className="space-y-3">
        {placements.map((placement) => {
          const isSelected = selectedPlacement === placement.id;
          return (
            <div key={placement.id} className="space-y-2">
              <button
                type="button"
                onClick={() => onSelect(placement.id)}
                className={`
                  w-full relative flex items-center justify-between gap-2 
                  min-h-[48px] px-4 py-3 rounded-lg border-2 
                  text-sm font-medium transition-all
                  ${isSelected 
                    ? "border-primary bg-primary/10 text-primary" 
                    : "border-slate-600 bg-slate-800/50 hover:border-primary/50 hover:bg-slate-700/50 text-white"
                  }
                `}
                data-testid={`button-placement-${placement.id}`}
              >
                <div className="flex items-center gap-2">
                  {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                  <span>{placement.title}</span>
                </div>
                {isSelected && (
                  <span className="text-xs px-2 py-1 rounded bg-primary/20 font-bold">
                    {placementSize.toUpperCase()}
                  </span>
                )}
              </button>

              {isSelected && (
                <div className="ml-4 space-y-2">
                  {showTypeToggle && onTypeChange && !qrOnlyPlacements.includes(placement.id) && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={placementType === "graphic" ? "default" : "outline"}
                        size="sm"
                        onClick={() => onTypeChange("graphic")}
                        className={`flex-1 ${placementType === "graphic" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-700 border-slate-500 text-white hover:bg-slate-600"}`}
                        data-testid={`placement-type-graphic-${placement.id}`}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Graphic
                      </Button>
                      <Button
                        type="button"
                        variant={placementType === "qr" ? "default" : "outline"}
                        size="sm"
                        onClick={() => onTypeChange("qr")}
                        className={`flex-1 ${placementType === "qr" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-700 border-slate-500 text-white hover:bg-slate-600"}`}
                        data-testid={`placement-type-qr-${placement.id}`}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        QR Code
                      </Button>
                    </div>
                  )}
                  
                  {showTypeToggle && qrOnlyPlacements.includes(placement.id) && (
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <QrCode className="h-3 w-3" />
                      This placement only supports QR codes
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Graphic Size:</span>
                    <div className="flex gap-1">
                      {SIZE_OPTIONS.map((size) => (
                        <Button
                          key={size.value}
                          type="button"
                          variant={placementSize === size.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => onSizeChange(size.value)}
                          className={`w-10 h-8 px-0 ${placementSize === size.value ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-700 border-slate-500 text-white hover:bg-slate-600"}`}
                          data-testid={`placement-size-${size.value}`}
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

      {selectedPlacement && (
        <div className="p-3 bg-primary/5 rounded-md border border-slate-600">
          <p className="text-sm font-medium text-white">
            Selected: {placements.find(p => p.id === selectedPlacement)?.title || selectedPlacement}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Size: {placementSize.charAt(0).toUpperCase() + placementSize.slice(1)}
          </p>
        </div>
      )}

      {!selectedPlacement && (
        <p className="text-sm text-amber-400 text-center">
          Please select a placement location to continue.
        </p>
      )}
    </div>
  );
}
