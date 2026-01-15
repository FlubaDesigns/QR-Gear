import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Paintbrush, FileImage, Image, Layers } from "lucide-react";
import { useState } from "react";
import { useBuilderContext } from "../BuilderContext";
import type { SourceType } from "../types";

export function SourceModule() {
  const { state, setSourceType } = useBuilderContext();
  const [isOpen, setIsOpen] = useState(true);

  const handleSourceSelect = (type: SourceType) => {
    setSourceType(type);
  };

  const getSourceLabel = (): string => {
    switch (state.sourceType) {
      case "custom": return "Custom";
      case "product_template": return "Product Template";
      case "graphic_template": return "Graphic Template";
      case "background": return "Background";
      default: return "Not Selected";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Source
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {getSourceLabel()}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose how to start building your product design.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={state.sourceType === "custom" ? "default" : "outline"}
                className={`h-20 flex flex-col items-center justify-center gap-1 ${state.sourceType === "custom" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onClick={() => handleSourceSelect("custom")}
                data-testid="button-source-custom"
              >
                <Paintbrush className="h-5 w-5" />
                <span className="font-semibold">Custom</span>
                <span className="text-xs opacity-70">Start fresh</span>
              </Button>

              <Button
                variant={state.sourceType === "product_template" ? "default" : "outline"}
                className={`h-20 flex flex-col items-center justify-center gap-1 ${state.sourceType === "product_template" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onClick={() => handleSourceSelect("product_template")}
                data-testid="button-source-product-template"
              >
                <FileImage className="h-5 w-5" />
                <span className="font-semibold">Product Template</span>
                <span className="text-xs opacity-70">Full saved design</span>
              </Button>

              <Button
                variant={state.sourceType === "graphic_template" ? "default" : "outline"}
                className={`h-20 flex flex-col items-center justify-center gap-1 ${state.sourceType === "graphic_template" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onClick={() => handleSourceSelect("graphic_template")}
                data-testid="button-source-graphic-template"
              >
                <Image className="h-5 w-5" />
                <span className="font-semibold">Graphic Template</span>
                <span className="text-xs opacity-70">Artwork + QR only</span>
              </Button>

              <Button
                variant={state.sourceType === "background" ? "default" : "outline"}
                className={`h-20 flex flex-col items-center justify-center gap-1 ${state.sourceType === "background" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onClick={() => handleSourceSelect("background")}
                data-testid="button-source-background"
              >
                <Layers className="h-5 w-5" />
                <span className="font-semibold">Background</span>
                <span className="text-xs opacity-70">Image only</span>
              </Button>
            </div>

            {state.sourceType === "product_template" && (
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Product Template</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Load a complete saved design. You can modify any part before saving.
                </p>
                <Button 
                  variant="secondary" 
                  size="sm"
                  data-testid="button-open-template-picker"
                >
                  Browse Templates
                </Button>
              </div>
            )}

            {state.sourceType === "graphic_template" && (
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Graphic Template</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Load artwork to apply to a new product. You'll get both the full composite and QR-only versions.
                </p>
                <Button 
                  variant="secondary" 
                  size="sm"
                  data-testid="button-open-graphic-picker"
                >
                  Browse Graphics
                </Button>
              </div>
            )}

            {state.sourceType === "background" && (
              <div className="p-3 border rounded-lg bg-muted/50 space-y-3">
                <p className="text-sm font-medium">Background</p>
                <p className="text-xs text-muted-foreground">
                  Choose a background image for your design.
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    data-testid="button-open-clipped-picker"
                  >
                    Clipped
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    data-testid="button-open-raw-picker"
                  >
                    Full (Raw)
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
