import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Palette, ChevronDown, ChevronRight, Image, Wand2 } from "lucide-react";
import { useState } from "react";
import { useStoreBuilderContext } from "../StoreBuilderContext";

const MOCK_COLORS = ["Black", "White", "Navy", "Red", "Forest Green", "Heather Gray"];

export function ProductConfigureModule() {
  const { step, selectedBaseProduct, addConfiguredProduct, setStep } = useStoreBuilderContext();
  const [expanded, setExpanded] = useState(step === "configure");
  const [enabledColors, setEnabledColors] = useState<Set<string>>(new Set(MOCK_COLORS));
  const [defaultColor, setDefaultColor] = useState("Black");
  const [isBlankCanvas, setIsBlankCanvas] = useState(false);

  if (!selectedBaseProduct) return null;
  if (step !== "configure") return null;

  const toggleColor = (color: string) => {
    const newColors = new Set(enabledColors);
    if (newColors.has(color)) {
      newColors.delete(color);
    } else {
      newColors.add(color);
    }
    setEnabledColors(newColors);
  };

  const handleConfigure = () => {
    addConfiguredProduct({
      id: `config-${Date.now()}`,
      baseProductId: selectedBaseProduct.id,
      baseProductName: selectedBaseProduct.name,
      enabledColors: Array.from(enabledColors),
      enabledSizes: [],
      defaultColor,
      isBlankCanvas,
    });
    setStep("assign");
  };

  return (
    <div className="border rounded-lg p-3" data-testid="module-product-configure">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left font-medium"
        data-testid="toggle-product-configure"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Palette className="h-4 w-4" />
        <span className="flex-1">Configure Product</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          <div className="p-3 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-2">{selectedBaseProduct.name}</h4>
            
            <div className="flex items-center gap-3 mb-4">
              <Switch
                checked={isBlankCanvas}
                onCheckedChange={setIsBlankCanvas}
                data-testid="switch-blank-canvas"
              />
              <span className="text-sm">Blank Canvas (member decorates)</span>
            </div>

            {!isBlankCanvas && (
              <div className="mb-4 p-3 border rounded-lg bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4" />
                  <span className="text-sm font-medium">Apply Graphic</span>
                </div>
                <Button variant="outline" size="sm" className="w-full" data-testid="button-select-graphic">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Select from Library
                </Button>
              </div>
            )}

            <div className="mb-4">
              <h5 className="text-sm font-medium mb-2">Available Colors ({enabledColors.size}/{MOCK_COLORS.length})</h5>
              <div className="flex flex-wrap gap-2">
                {MOCK_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => toggleColor(color)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                      enabledColors.has(color)
                        ? "border-primary bg-primary/10"
                        : "border-border opacity-50"
                    }`}
                    data-testid={`button-color-${color}`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h5 className="text-sm font-medium mb-2">Default Display Color</h5>
              <div className="flex flex-wrap gap-2">
                {Array.from(enabledColors).map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDefaultColor(color)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                      defaultColor === color
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                    data-testid={`button-default-${color}`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleConfigure}
              className="w-full"
              data-testid="button-finish-configure"
            >
              {isBlankCanvas ? "Add as Blank Canvas" : "Generate Mockup & Add"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
