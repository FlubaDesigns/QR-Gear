import { useState } from "react";
import { Save, Layers, Store, Archive } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Card } from "@/components/ui/card";
import { useBuilderContext } from "../BuilderContext";

export type SaveTarget = "template" | "graphic-set" | "store" | "all" | null;

interface SaveOptionsModuleProps {
  onSaveTargetChange?: (target: SaveTarget) => void;
}

export function SaveOptionsModule({ onSaveTargetChange }: SaveOptionsModuleProps) {
  const { state } = useBuilderContext();
  const [selectedTarget, setSelectedTarget] = useState<SaveTarget>(null);

  const hasContent = state.content.url || state.content.title;
  const hasProduct = state.selectedProduct;
  const hasQRState = state.qrProductState;
  const canSave = hasProduct && hasQRState && hasContent;

  if (!canSave) {
    return null;
  }

  const handleSelect = (target: SaveTarget) => {
    setSelectedTarget(target);
    onSaveTargetChange?.(target);
    // Template and graphic-set saves are handled by BuilderHarness
    // Store and All will show StoreModule for channel selection
  };

  const options = [
    {
      id: "template" as const,
      label: "Template",
      description: "Save to library for reuse",
      icon: Layers,
    },
    {
      id: "graphic-set" as const,
      label: "Graphic Set",
      description: "Save artwork + QR combo",
      icon: Archive,
    },
    {
      id: "store" as const,
      label: "Store",
      description: "Add to a store channel",
      icon: Store,
    },
    {
      id: "all" as const,
      label: "Save All",
      description: "Template + Graphics + Store",
      icon: Save,
    },
  ];

  return (
    <CollapsibleModule
      title="Save Options"
      icon={<Save className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose where to save your design.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedTarget === option.id;
            const isPrimary = option.id === "all";

            return (
              <Card
                key={option.id}
                className={`p-4 cursor-pointer hover-elevate transition-all ${
                  isSelected 
                    ? "ring-2 ring-primary bg-primary/10" 
                    : isPrimary 
                      ? "border-primary bg-primary/5" 
                      : ""
                }`}
                onClick={() => handleSelect(option.id)}
                data-testid={`save-option-${option.id}`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`p-3 rounded-lg ${
                    isSelected 
                      ? "bg-primary text-primary-foreground" 
                      : isPrimary 
                        ? "bg-primary/20 text-primary" 
                        : "bg-muted"
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {selectedTarget && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm">
              <span className="font-medium">Selected: </span>
              {options.find(o => o.id === selectedTarget)?.label}
            </p>
            {(selectedTarget === "store" || selectedTarget === "all") && (
              <p className="text-xs text-muted-foreground mt-1">
                Choose your store and channel below ↓
              </p>
            )}
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
