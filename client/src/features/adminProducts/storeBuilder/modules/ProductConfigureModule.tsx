import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Palette, Image, Wand2, Loader2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreBuilderContext } from "../StoreBuilderContext";

const DEFAULT_COLORS = ["Black", "White", "Navy", "Red", "Forest Green", "Heather Gray"];
const DEFAULT_SIZES = ["S", "M", "L", "XL", "2XL"];

export function ProductConfigureModule() {
  const { step, selectedBaseProduct, addConfiguredProduct, setStep } = useStoreBuilderContext();
  const [enabledColors, setEnabledColors] = useState<Set<string>>(new Set(DEFAULT_COLORS));
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(new Set(DEFAULT_SIZES));
  const [defaultColor, setDefaultColor] = useState("Black");
  const [isBlankCanvas, setIsBlankCanvas] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);

  if (!selectedBaseProduct) {
    return null;
  }

  const toggleColor = (color: string) => {
    const newColors = new Set(enabledColors);
    if (newColors.has(color)) {
      if (newColors.size > 1) newColors.delete(color);
    } else {
      newColors.add(color);
    }
    setEnabledColors(newColors);
    if (!newColors.has(defaultColor)) {
      setDefaultColor(Array.from(newColors)[0]);
    }
  };

  const toggleSize = (size: string) => {
    const newSizes = new Set(enabledSizes);
    if (newSizes.has(size)) {
      if (newSizes.size > 1) newSizes.delete(size);
    } else {
      newSizes.add(size);
    }
    setEnabledSizes(newSizes);
  };

  const handleConfigure = async () => {
    setIsConfiguring(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      
      addConfiguredProduct({
        id: `config-${Date.now()}`,
        baseProductId: selectedBaseProduct.id,
        baseProductName: selectedBaseProduct.name,
        enabledColors: Array.from(enabledColors),
        enabledSizes: Array.from(enabledSizes),
        defaultColor,
        isBlankCanvas,
      });
      setStep("assign");
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <CollapsibleModule
      title="Configure Product"
      icon={<Palette className="h-4 w-4" />}
      defaultOpen={step === "configure"}
    >
      <div className="space-y-4">
        <div className="p-3 bg-muted/30 rounded-lg">
          <h4 className="font-medium mb-3">{selectedBaseProduct.name}</h4>

          <div className="flex items-center gap-3 mb-4 p-2 border rounded-md">
            <Switch
              checked={isBlankCanvas}
              onCheckedChange={setIsBlankCanvas}
              data-testid="switch-blank-canvas"
            />
            <div>
              <span className="text-sm font-medium">Blank Canvas Mode</span>
              <p className="text-xs text-muted-foreground">Member can add their own design</p>
            </div>
          </div>

          {!isBlankCanvas && (
            <div className="mb-4 p-3 border rounded-lg">
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
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Colors</h5>
              <Badge variant="outline" className="text-xs">{enabledColors.size} selected</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_COLORS.map(color => (
                <Button
                  key={color}
                  variant={enabledColors.has(color) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleColor(color)}
                  data-testid={`button-color-${color}`}
                >
                  {color}
                </Button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium">Sizes</h5>
              <Badge variant="outline" className="text-xs">{enabledSizes.size} selected</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_SIZES.map(size => (
                <Button
                  key={size}
                  variant={enabledSizes.has(size) ? "default" : "outline"}
                  size="sm"
                  className="h-7 w-12 text-xs"
                  onClick={() => toggleSize(size)}
                  data-testid={`button-size-${size}`}
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <h5 className="text-sm font-medium mb-2">Default Display Color</h5>
            <div className="flex flex-wrap gap-1">
              {Array.from(enabledColors).map(color => (
                <Button
                  key={color}
                  variant={defaultColor === color ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDefaultColor(color)}
                  data-testid={`button-default-${color}`}
                >
                  {color}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleConfigure}
            className="w-full"
            disabled={isConfiguring}
            data-testid="button-finish-configure"
          >
            {isConfiguring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Configuring...
              </>
            ) : isBlankCanvas ? (
              "Add as Blank Canvas"
            ) : (
              "Add with Graphic"
            )}
          </Button>
        </div>
      </div>
    </CollapsibleModule>
  );
}
