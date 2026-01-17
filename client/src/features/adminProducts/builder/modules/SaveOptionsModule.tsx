import { useState } from "react";
import { Save, Layers, Archive, Store, ArrowRight } from "lucide-react";
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
  const showModule = hasProduct && hasQRState;

  const handleSelect = (target: SaveTarget) => {
    setSelectedTarget(target);
    onSaveTargetChange?.(target);
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
      description: "Go to store assignment",
      icon: Store,
    },
    {
      id: "all" as const,
      label: "Save All",
      description: "Save all, then assign",
      icon: ArrowRight,
      isPrimary: true,
    },
  ];

  if (!showModule) {
    return null;
  }

  return (
    <CollapsibleModule
      title="Save Options"
      icon={<Save className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {!canSave && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-md border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Enter content above to enable save options
            </p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Choose where to save your design.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedTarget === option.id;
            const isPrimary = "isPrimary" in option && option.isPrimary;
            const isDisabled = !canSave;

            return (
              <Card
                key={option.id}
                className={`min-h-[100px] p-4 transition-all ${
                  isDisabled 
                    ? "opacity-50 cursor-not-allowed" 
                    : "cursor-pointer hover-elevate"
                } ${
                  isSelected 
                    ? "ring-2 ring-primary bg-primary/10" 
                    : isPrimary 
                      ? "border-primary bg-primary/5" 
                      : ""
                }`}
                onClick={() => !isDisabled && handleSelect(option.id)}
                data-testid={`save-option-${option.id}`}
              >
                <div className="flex flex-col items-center text-center gap-3 min-h-[48px]">
                  <div className={`p-3 rounded-lg min-w-[48px] min-h-[48px] flex items-center justify-center ${
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

        {selectedTarget && canSave && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm">
              <span className="font-medium">Selected: </span>
              {options.find(o => o.id === selectedTarget)?.label}
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
