import { useState } from "react";
import { ChevronDown, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getColorHex, type ProductPackage, type ProductConfiguration, type MockupJob } from "./store-builder-types";

export function CollapsibleSection({ 
  title, 
  icon, 
  defaultOpen = false, 
  children 
}: { 
  title: string; 
  icon?: React.ReactNode;
  defaultOpen?: boolean; 
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover-elevate"
        data-testid={`collapse-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="p-3 border-t">
          {children}
        </div>
      )}
    </div>
  );
}

export function HeroImageLightbox({
  isOpen,
  onClose,
  productPackage,
  configuration,
  mockups,
  onSelectColor,
  onSelectGraphicSize,
}: {
  isOpen: boolean;
  onClose: () => void;
  productPackage: ProductPackage | null;
  configuration: ProductConfiguration;
  mockups: MockupJob[];
  onSelectColor: (color: string) => void;
  onSelectGraphicSize: (size: string) => void;
}) {
  if (!isOpen || !productPackage) return null;

  const availableColors = productPackage.colors || [];
  const graphicSizes = ["small", "medium", "large"];
  
  const currentMockup = mockups.find(
    m => m.status === "completed" && 
         m.mockupUrl && 
         m.color === configuration.defaultColor
  );

  const previewUrl = currentMockup?.mockupUrl || productPackage.productImageUrl || productPackage.compositeUrl;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-background rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <h3 className="font-semibold">Set Hero Image</h3>
        </div>
        
        <div className="p-4 space-y-4">
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

          <div className="space-y-3">
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
                  >
                  </button>
                ))}
              </div>
              {configuration.defaultColor && (
                <p className="text-xs text-muted-foreground mt-1">Selected: {configuration.defaultColor}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Graphic Size</p>
              <div className="flex gap-2">
                {graphicSizes.map(size => (
                  <Button
                    key={size}
                    variant={configuration.selectedGraphicSize === size ? "default" : "outline"}
                    size="sm"
                    className="capitalize flex-1"
                    onClick={() => onSelectGraphicSize(size)}
                    data-testid={`lightbox-graphic-${size}`}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t">
          <Button className="w-full" onClick={onClose} data-testid="button-confirm-hero">
            <Check className="h-4 w-4 mr-2" />
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
