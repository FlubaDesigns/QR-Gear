import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalView } from "@/features/shared/components/shapes/ModalView";
import { getColorHex, type ProductPackage, type ProductConfiguration, type MockupJob } from "./store-builder-types";

export function HeroImageLightbox({
  isOpen,
  onClose,
  productPackage,
  configuration,
  mockups,
  onSelectColor,
}: {
  isOpen: boolean;
  onClose: () => void;
  productPackage: ProductPackage | null;
  configuration: ProductConfiguration;
  mockups: MockupJob[];
  onSelectColor: (color: string) => void;
}) {
  if (!productPackage) return null;

  const availableColors = productPackage.colors || [];

  const currentMockup = mockups.find(
    m => m.status === "completed" && m.mockupUrl && m.color === configuration.defaultColor
  );
  const previewUrl = currentMockup?.mockupUrl || productPackage.productImageUrl || productPackage.compositeUrl;

  return (
    <ModalView
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Set Hero Image"
      maxWidth="max-w-lg"
    >
      <div className="p-4 border-b">
        <h3 className="font-semibold">Set Hero Image</h3>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
        <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Hero preview"
              className="w-full h-full object-contain"
              data-testid="img-hero-preview"
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Mockup generating...</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Default Color</p>
          <div className="flex flex-wrap gap-2">
            {availableColors.map(color => (
              <button
                key={color.name}
                onClick={() => onSelectColor(color.name)}
                className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                  configuration.defaultColor === color.name
                    ? "ring-2 ring-offset-2 ring-primary border-primary"
                    : "border-muted hover:border-primary/50"
                }`}
                style={{ backgroundColor: getColorHex(color) }}
                title={color.name}
                data-testid={`lightbox-color-${color.name}`}
              />
            ))}
          </div>
          {configuration.defaultColor && (
            <p className="text-xs text-muted-foreground mt-1">Selected: {configuration.defaultColor}</p>
          )}
        </div>
      </div>

      <div className="p-4 border-t">
        <Button className="w-full" onClick={onClose} data-testid="button-confirm-hero">
          <Check className="h-4 w-4 mr-2" />
          Confirm Selection
        </Button>
      </div>
    </ModalView>
  );
}
