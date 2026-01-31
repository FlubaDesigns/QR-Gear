import { Check, MapPin, QrCode, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  QR_ONLY_PLACEMENTS, 
  type PlacementSize, 
  type PlacementType 
} from "@/features/shared/placementTypes";

export type { PlacementSize, PlacementType };

export interface Placement {
  id: string;
  title: string;
}

export interface PlacementConfig {
  type: PlacementType;
  size: PlacementSize;
}

export interface PlacementPickerProps {
  placements: Placement[];
  selectedPlacements: string[];
  placementConfigs: Record<string, PlacementConfig>;
  onToggle: (placementId: string) => void;
  onTypeChange: (placementId: string, type: PlacementType) => void;
  onSizeChange: (placementId: string, size: PlacementSize) => void;
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
  selectedPlacements,
  placementConfigs,
  onToggle,
  onTypeChange,
  onSizeChange,
  showTypeToggle = true,
  qrOnlyPlacements = QR_ONLY_PLACEMENTS as string[],
  productTitle,
  title = "Pick Locations",
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

  const selectedCount = selectedPlacements.length;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400">
          {subtitle || (productTitle ? `Select one or more locations on the ${productTitle}` : "Select one or more locations for your design")}
        </p>
      </div>

      <div className="space-y-3">
        {placements.map((placement) => {
          const isSelected = selectedPlacements.includes(placement.id);
          const config = placementConfigs[placement.id] || { type: 'qr', size: 'medium' };
          const isQrOnly = qrOnlyPlacements.includes(placement.id);
          
          return (
            <div key={placement.id} className="space-y-2">
              <button
                type="button"
                onClick={() => onToggle(placement.id)}
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
                  <div className="flex items-center gap-2">
                    {showTypeToggle && (
                      <span className="text-xs px-2 py-1 rounded bg-slate-700">
                        {config.type === "qr" ? "QR" : "Graphic"}
                      </span>
                    )}
                    <span className="text-xs px-2 py-1 rounded bg-primary/20 font-bold">
                      {config.size.toUpperCase()}
                    </span>
                  </div>
                )}
              </button>

              {isSelected && (
                <div className="ml-4 space-y-2">
                  {showTypeToggle && !isQrOnly && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={config.type === "graphic" ? "default" : "outline"}
                        size="sm"
                        onClick={() => onTypeChange(placement.id, "graphic")}
                        className={`flex-1 ${config.type === "graphic" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-700 border-slate-500 text-white hover:bg-slate-600"}`}
                        data-testid={`placement-type-graphic-${placement.id}`}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Graphic
                      </Button>
                      <Button
                        type="button"
                        variant={config.type === "qr" ? "default" : "outline"}
                        size="sm"
                        onClick={() => onTypeChange(placement.id, "qr")}
                        className={`flex-1 ${config.type === "qr" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-700 border-slate-500 text-white hover:bg-slate-600"}`}
                        data-testid={`placement-type-qr-${placement.id}`}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        QR Code
                      </Button>
                    </div>
                  )}
                  
                  {showTypeToggle && isQrOnly && (
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <QrCode className="h-3 w-3" />
                      This placement only supports QR codes
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Size:</span>
                    <div className="flex gap-1">
                      {SIZE_OPTIONS.map((size) => (
                        <Button
                          key={size.value}
                          type="button"
                          variant={config.size === size.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => onSizeChange(placement.id, size.value)}
                          className={`w-10 h-8 px-0 ${config.size === size.value ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-700 border-slate-500 text-white hover:bg-slate-600"}`}
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
        <div className="p-3 bg-primary/5 rounded-md border border-slate-600">
          <p className="text-sm font-medium text-white">
            {selectedCount} placement{selectedCount > 1 ? "s" : ""} selected
          </p>
          <div className="text-xs text-slate-400 mt-2 space-y-1">
            {selectedPlacements.map(p => {
              const placement = placements.find(opt => opt.id === p);
              const label = placement?.title || p;
              const config = placementConfigs[p] || { type: 'qr', size: 'medium' };
              return (
                <p key={p}>
                  <span className="font-medium text-white">{label}:</span>{" "}
                  {showTypeToggle ? (config.type === "qr" ? "QR Code" : "Graphic") + " • " : ""}
                  {config.size.charAt(0).toUpperCase() + config.size.slice(1)}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {selectedCount === 0 && (
        <p className="text-sm text-amber-400 text-center">
          Please select at least one placement location.
        </p>
      )}
    </div>
  );
}
