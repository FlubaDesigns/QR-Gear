import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Check, Loader2, ImageIcon, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ColorOption {
  name: string;
  hex: string;
  hasMockup?: boolean;
  mockupUrl?: string;
}

interface ProductConfigSkinProps {
  productId: string;
  productName: string;
  productImage?: string;
  sizes: string[];
  colors: ColorOption[];
  enabledSizes?: string[];
  enabledColors?: string[];
  defaultColor?: string;
  mockupsByColor?: Record<string, { front?: string; lifestyle?: string }>;
  blueprintId?: number;
  printProviderId?: number;
  apiBase?: string;
  onUpdate?: () => void;
  readOnly?: boolean;
}

function ColorSwatch({ hex, className = "", testId }: { hex: string; className?: string; testId?: string }) {
  return (
    <div
      className={`w-5 h-5 rounded-sm border flex-shrink-0 ${className}`}
      style={{ backgroundColor: hex }}
      data-testid={testId || "color-swatch"}
    />
  );
}

export function ProductConfigSkin({
  productId,
  productName,
  productImage,
  sizes,
  colors,
  enabledSizes: initialEnabledSizes,
  enabledColors: initialEnabledColors,
  defaultColor: initialDefaultColor,
  mockupsByColor,
  blueprintId,
  printProviderId,
  apiBase = "/api/test",
  onUpdate,
  readOnly = false,
}: ProductConfigSkinProps) {
  const { toast } = useToast();
  const [enabledSizes, setEnabledSizes] = useState<Set<string>>(
    new Set(initialEnabledSizes || sizes)
  );
  const [enabledColors, setEnabledColors] = useState<Set<string>>(
    new Set(initialEnabledColors || colors.map((c) => c.name))
  );
  const [defaultColor, setDefaultColor] = useState<string | null>(
    initialDefaultColor || (colors.length > 0 ? colors[0].name : null)
  );
  const [showSizes, setShowSizes] = useState(true);
  const [showColors, setShowColors] = useState(true);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedQrSize, setSelectedQrSize] = useState<'S' | 'M' | 'L'>('M');

  useEffect(() => {
    setEnabledSizes(new Set(initialEnabledSizes || sizes));
  }, [initialEnabledSizes, sizes]);

  useEffect(() => {
    setEnabledColors(new Set(initialEnabledColors || colors.map((c) => c.name)));
  }, [initialEnabledColors, colors]);

  useEffect(() => {
    setDefaultColor(initialDefaultColor || (colors.length > 0 ? colors[0].name : null));
  }, [initialDefaultColor, colors]);

  const qrSizePercent = { S: 25, M: 45, L: 65 };

  const saveOptions = async (newSizes: string[], newColors: string[], newDefaultColor?: string) => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `${apiBase}/products/${productId}/options`, {
        enabledSizes: newSizes,
        enabledColors: newColors,
        defaultColor: newDefaultColor || defaultColor,
      });
      toast({ title: "Saved", description: "Product options updated" });
      onUpdate?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSize = async (size: string) => {
    if (readOnly) return;
    const newSizes = new Set(enabledSizes);
    if (newSizes.has(size)) {
      newSizes.delete(size);
    } else {
      newSizes.add(size);
    }
    setEnabledSizes(newSizes);
    await saveOptions(Array.from(newSizes), Array.from(enabledColors));
  };

  const toggleColor = async (colorName: string) => {
    if (readOnly) return;
    const newColors = new Set(enabledColors);
    if (newColors.has(colorName)) {
      newColors.delete(colorName);
    } else {
      newColors.add(colorName);
    }
    setEnabledColors(newColors);
    await saveOptions(Array.from(enabledSizes), Array.from(newColors));
  };

  const selectDefaultColor = async (colorName: string) => {
    if (readOnly) return;
    setDefaultColor(colorName);
    setShowImagePicker(false);
    await saveOptions(Array.from(enabledSizes), Array.from(enabledColors), colorName);
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${apiBase}/products/${productId}/sync-printify`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      toast({ title: "Success", description: "Sizes and colors synced from Printify" });
      onUpdate?.();
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const generateMockupMutation = useMutation({
    mutationFn: async (color: string) => {
      const qrSizeMap = { S: 'small', M: 'medium', L: 'large' } as const;
      const response = await fetch("/api/storefront/generate-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          color,
          qrSize: qrSizeMap[selectedQrSize],
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate mockup");
      }
      return response.json();
    },
    onSuccess: (data, color) => {
      toast({
        title: "Mockup generated",
        description: `${color} mockup is ready`,
      });
      onUpdate?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate mockup",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDisplayImage = () => {
    if (defaultColor && mockupsByColor?.[defaultColor]) {
      return mockupsByColor[defaultColor].lifestyle || mockupsByColor[defaultColor].front;
    }
    const firstMockup = mockupsByColor
      ? Object.values(mockupsByColor).find((m) => m?.front)?.front
      : null;
    return firstMockup || productImage;
  };

  const displayImage = getDisplayImage();
  const mockupCount = mockupsByColor ? Object.keys(mockupsByColor).filter(k => mockupsByColor[k]?.front).length : 0;
  const hasPrintifyData = blueprintId && printProviderId;

  // Show sync button if no sizes/colors
  if (sizes.length === 0 && colors.length === 0 && hasPrintifyData) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-card" data-testid={`product-config-${productId}`}>
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="w-24 h-24 rounded-lg object-cover border-2 border-border"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{productName}</h3>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-sm text-muted-foreground">No sizes/colors synced yet</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={triggerSync}
                disabled={syncing}
                data-testid={`button-sync-${productId}`}
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sync from Printify
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card" data-testid={`product-config-${productId}`}>
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <div className="relative">
            {displayImage ? (
              <img
                src={displayImage}
                alt={productName}
                className="w-24 h-24 rounded-lg object-cover border-2 border-border"
                data-testid={`img-product-config-${productId}`}
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate" data-testid={`text-product-name-${productId}`}>
            {productName}
          </h3>
          <div className="flex flex-wrap gap-1 mt-2">
            {defaultColor && (
              <Badge variant="outline" className="text-xs" data-testid={`badge-default-color-${productId}`}>
                Default: {defaultColor}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs" data-testid={`badge-sizes-${productId}`}>
              {enabledSizes.size}/{sizes.length} sizes
            </Badge>
            <Badge variant="secondary" className="text-xs" data-testid={`badge-colors-${productId}`}>
              {enabledColors.size}/{colors.length} colors
            </Badge>
            {mockupCount > 0 && (
              <Badge variant="outline" className="text-xs text-green-600" data-testid={`badge-mockups-${productId}`}>
                <Check className="w-3 h-3 mr-1" />
                {mockupCount} mockups
              </Badge>
            )}
          </div>
          {hasPrintifyData && !readOnly && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={triggerSync}
              disabled={syncing}
              className="mt-2 h-8"
              data-testid={`button-sync-${productId}`}
            >
              {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Sync Printify
            </Button>
          )}
        </div>
      </div>

      {sizes.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowSizes(!showSizes)}
            className="flex items-center gap-2 text-sm font-medium hover-elevate px-2 py-1 rounded -ml-2"
            data-testid={`toggle-sizes-${productId}`}
          >
            {showSizes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Sizes ({enabledSizes.size}/{sizes.length})
            {saving && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          </button>
          {showSizes && (
            <div className="flex flex-wrap gap-2 mt-2 pl-6">
              {sizes.map((size) => (
                <div
                  key={size}
                  className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded"
                >
                  <Switch
                    id={`size-${productId}-${size}`}
                    checked={enabledSizes.has(size)}
                    onCheckedChange={() => toggleSize(size)}
                    disabled={saving || readOnly}
                    data-testid={`switch-size-${productId}-${size}`}
                  />
                  <Label
                    htmlFor={`size-${productId}-${size}`}
                    className="text-sm cursor-pointer"
                  >
                    {size}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {colors.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowColors(!showColors)}
            className="flex items-center gap-2 text-sm font-medium hover-elevate px-2 py-1 rounded -ml-2"
            data-testid={`toggle-colors-${productId}`}
          >
            {showColors ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Colors ({enabledColors.size}/{colors.length})
            {saving && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          </button>
          {showColors && (
            <div className="flex flex-wrap gap-2 mt-2 pl-6">
              {colors.map((color) => {
                const hasMockup = mockupsByColor?.[color.name]?.front;
                return (
                  <div
                    key={color.name}
                    className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded"
                  >
                    <Switch
                      id={`color-${productId}-${color.name}`}
                      checked={enabledColors.has(color.name)}
                      onCheckedChange={() => toggleColor(color.name)}
                      disabled={saving || readOnly}
                      data-testid={`switch-color-${productId}-${color.name}`}
                    />
                    <ColorSwatch hex={color.hex} testId={`swatch-color-${productId}-${color.name}`} />
                    <Label
                      htmlFor={`color-${productId}-${color.name}`}
                      className="text-sm cursor-pointer"
                    >
                      {color.name}
                    </Label>
                    {hasMockup && <Check className="w-4 h-4 text-green-500" />}
                  </div>
                );
              })}
            </div>
          )}

          {!readOnly && (
            <>
              {/* Default Image Picker */}
              <div className="mt-3 p-3 bg-muted/30 rounded-lg border">
                <button
                  type="button"
                  onClick={() => setShowImagePicker(!showImagePicker)}
                  className="flex items-center gap-2 text-sm font-medium hover-elevate px-2 py-1 rounded -ml-2"
                  data-testid={`toggle-image-picker-${productId}`}
                >
                  {showImagePicker ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  Default Display Image
                  {defaultColor && (
                    <Badge variant="outline" className="text-xs ml-2">
                      {defaultColor}
                    </Badge>
                  )}
                </button>
                {showImagePicker && (
                  <div className="mt-2 pl-6">
                    <p className="text-xs text-muted-foreground mb-2">Select which color to display by default:</p>
                    <div className="flex flex-wrap gap-2">
                      {colors.filter((c) => enabledColors.has(c.name)).map((color) => {
                        const hasMockup = mockupsByColor?.[color.name]?.front;
                        const isDefault = defaultColor === color.name;
                        return (
                          <button
                            key={color.name}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-all ${
                              isDefault
                                ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-1"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => selectDefaultColor(color.name)}
                            data-testid={`button-select-default-${productId}-${color.name}`}
                          >
                            <ColorSwatch hex={color.hex} className="w-4 h-4" testId={`swatch-default-${productId}-${color.name}`} />
                            <span>{color.name}</span>
                            {hasMockup && <Check className="w-3 h-3 text-green-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mockup Generation Section */}
              <div className="mt-3 p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium">Generate Mockup:</span>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    list={`colors-list-${productId}`}
                    placeholder="Type or speak color..."
                    className="h-9 px-3 rounded border bg-background text-sm min-w-[140px]"
                    value={selectedColor || ""}
                    onChange={(e) => setSelectedColor(e.target.value || null)}
                    data-testid={`input-color-${productId}`}
                  />
                  <datalist id={`colors-list-${productId}`}>
                    {colors.filter(c => enabledColors.has(c.name)).map(c => (
                      <option key={c.name} value={c.name} />
                    ))}
                  </datalist>
                  
                  {/* QR Size Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">QR:</span>
                    {(['S', 'M', 'L'] as const).map(size => (
                      <Button
                        key={size}
                        size="sm"
                        variant={selectedQrSize === size ? 'default' : 'outline'}
                        className="h-8 w-8 p-0"
                        onClick={() => setSelectedQrSize(size)}
                        data-testid={`button-qr-${size}-${productId}`}
                      >
                        {size}
                      </Button>
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">({qrSizePercent[selectedQrSize]}%)</span>
                  </div>
                  
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={!selectedColor || generateMockupMutation.isPending}
                    onClick={() => selectedColor && generateMockupMutation.mutate(selectedColor)}
                    data-testid={`button-generate-${productId}`}
                  >
                    {generateMockupMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : null}
                    Generate
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {sizes.length === 0 && colors.length === 0 && !hasPrintifyData && (
        <p className="text-sm text-muted-foreground" data-testid={`text-no-options-${productId}`}>
          No sizes or colors available for this product.
        </p>
      )}
    </div>
  );
}

export default ProductConfigSkin;
