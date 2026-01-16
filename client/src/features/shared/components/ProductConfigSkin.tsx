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

function ColorSwatch({ hex, className = "", testId, size = "md" }: { hex: string; className?: string; testId?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-10 h-10"
  };
  return (
    <div
      className={`${sizeClasses[size]} rounded-md border-2 flex-shrink-0 ${className}`}
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
          <h3 className="font-semibold text-lg" data-testid={`text-product-name-${productId}`}>
            {productName}
          </h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {defaultColor && (
              <Badge variant="outline" data-testid={`badge-default-color-${productId}`}>
                Default: {defaultColor}
              </Badge>
            )}
            <Badge variant="secondary" data-testid={`badge-sizes-${productId}`}>
              {enabledSizes.size}/{sizes.length} sizes
            </Badge>
            <Badge variant="secondary" data-testid={`badge-colors-${productId}`}>
              {enabledColors.size}/{colors.length} colors
            </Badge>
            {mockupCount > 0 && (
              <Badge variant="outline" className="text-green-600" data-testid={`badge-mockups-${productId}`}>
                <Check className="w-4 h-4 mr-1" />
                {mockupCount} mockups
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {hasPrintifyData && !readOnly && (
        <Button 
          variant="outline" 
          onClick={triggerSync}
          disabled={syncing}
          className="w-full h-12 text-base"
          data-testid={`button-sync-${productId}`}
        >
          {syncing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <RefreshCw className="h-5 w-5 mr-2" />}
          Sync from Printify
        </Button>
      )}

      {sizes.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowSizes(!showSizes)}
            className="flex items-center gap-3 text-base font-medium hover-elevate px-3 py-3 rounded-lg -ml-3 w-full"
            data-testid={`toggle-sizes-${productId}`}
          >
            {showSizes ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            <span className="flex-1 text-left">Sizes</span>
            <Badge variant="secondary" className="text-sm">{enabledSizes.size}/{sizes.length}</Badge>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          </button>
          {showSizes && (
            <div className="flex flex-col gap-2 mt-2">
              {sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => !saving && !readOnly && toggleSize(size)}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                    enabledSizes.has(size) 
                      ? "bg-primary/10 border-primary" 
                      : "bg-muted/30 border-transparent hover:border-muted-foreground/20"
                  }`}
                  disabled={saving || readOnly}
                  data-testid={`switch-size-${productId}-${size}`}
                >
                  <span className="text-base font-medium">{size}</span>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    enabledSizes.has(size) ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {enabledSizes.has(size) && <Check className="w-4 h-4" />}
                  </div>
                </button>
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
            className="flex items-center gap-3 text-base font-medium hover-elevate px-3 py-3 rounded-lg -ml-3 w-full"
            data-testid={`toggle-colors-${productId}`}
          >
            {showColors ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            <span className="flex-1 text-left">Colors</span>
            <Badge variant="secondary" className="text-sm">{enabledColors.size}/{colors.length}</Badge>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          </button>
          {showColors && (
            <div className="flex flex-col gap-2 mt-2">
              {colors.map((color) => {
                const hasMockup = mockupsByColor?.[color.name]?.front;
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => !saving && !readOnly && toggleColor(color.name)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-lg border-2 transition-all ${
                      enabledColors.has(color.name) 
                        ? "bg-primary/10 border-primary" 
                        : "bg-muted/30 border-transparent hover:border-muted-foreground/20"
                    }`}
                    disabled={saving || readOnly}
                    data-testid={`switch-color-${productId}-${color.name}`}
                  >
                    <ColorSwatch hex={color.hex} testId={`swatch-color-${productId}-${color.name}`} />
                    <span className="flex-1 text-left text-base font-medium">{color.name}</span>
                    {hasMockup && <Check className="w-5 h-5 text-green-500" />}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      enabledColors.has(color.name) ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {enabledColors.has(color.name) && <Check className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!readOnly && (
            <>
              {/* Default Image Picker */}
              <div className="mt-4 p-4 bg-muted/30 rounded-xl border">
                <button
                  type="button"
                  onClick={() => setShowImagePicker(!showImagePicker)}
                  className="flex items-center gap-3 text-base font-medium hover-elevate px-3 py-3 rounded-lg -ml-3 w-full"
                  data-testid={`toggle-image-picker-${productId}`}
                >
                  {showImagePicker ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <span className="flex-1 text-left">Default Display Image</span>
                  {defaultColor && (
                    <Badge variant="outline">{defaultColor}</Badge>
                  )}
                </button>
                {showImagePicker && (
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground mb-3">Tap to select default color:</p>
                    <div className="flex flex-col gap-2">
                      {colors.filter((c) => enabledColors.has(c.name)).map((color) => {
                        const hasMockup = mockupsByColor?.[color.name]?.front;
                        const isDefault = defaultColor === color.name;
                        return (
                          <button
                            key={color.name}
                            className={`flex items-center gap-4 px-4 py-3 rounded-lg border-2 transition-all ${
                              isDefault
                                ? "border-primary bg-primary/10"
                                : "border-transparent bg-background hover:border-muted-foreground/20"
                            }`}
                            onClick={() => selectDefaultColor(color.name)}
                            data-testid={`button-select-default-${productId}-${color.name}`}
                          >
                            <ColorSwatch hex={color.hex} testId={`swatch-default-${productId}-${color.name}`} />
                            <span className="flex-1 text-left text-base font-medium">{color.name}</span>
                            {hasMockup && <Check className="w-5 h-5 text-green-500" />}
                            {isDefault && (
                              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                <Check className="w-4 h-4" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mockup Generation Section */}
              <div className="mt-4 p-4 bg-muted/30 rounded-xl border">
                <h4 className="text-base font-medium mb-4">Generate Mockup</h4>
                
                {/* Color search with voice support */}
                <div className="mb-4">
                  <label className="text-sm text-muted-foreground mb-2 block">Color (tap or speak):</label>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    list={`colors-${productId}`}
                    placeholder="Type or speak color name..."
                    className="w-full h-12 px-4 rounded-lg border-2 bg-background text-base"
                    value={selectedColor || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = colors.find(c => c.name.toLowerCase() === val.toLowerCase());
                      setSelectedColor(match ? match.name : val);
                    }}
                    data-testid={`input-color-${productId}`}
                  />
                  <datalist id={`colors-${productId}`}>
                    {colors.filter(c => enabledColors.has(c.name)).map(c => (
                      <option key={c.name} value={c.name}>
                        {mockupsByColor?.[c.name]?.front ? '(has mockup)' : ''}
                      </option>
                    ))}
                  </datalist>
                </div>
                
                {/* QR Size Selector - bigger buttons */}
                <div className="mb-4">
                  <label className="text-sm text-muted-foreground mb-2 block">QR Code Size:</label>
                  <div className="flex gap-2">
                    {(['S', 'M', 'L'] as const).map(size => (
                      <Button
                        key={size}
                        variant={selectedQrSize === size ? 'default' : 'outline'}
                        className="flex-1 h-12 text-lg"
                        onClick={() => setSelectedQrSize(size)}
                        data-testid={`button-qr-${size}-${productId}`}
                      >
                        {size === 'S' ? 'Small' : size === 'M' ? 'Medium' : 'Large'}
                        <span className="text-xs ml-1 opacity-70">({qrSizePercent[size]}%)</span>
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Generate button - full width */}
                <Button
                  className="w-full h-14 text-lg"
                  disabled={!selectedColor || !colors.some(c => c.name.toLowerCase() === selectedColor?.toLowerCase()) || generateMockupMutation.isPending}
                  onClick={() => {
                    const match = colors.find(c => c.name.toLowerCase() === selectedColor?.toLowerCase());
                    if (match) generateMockupMutation.mutate(match.name);
                  }}
                  data-testid={`button-generate-${productId}`}
                >
                  {generateMockupMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <ImageIcon className="w-5 h-5 mr-2" />
                  )}
                  Generate Mockup
                </Button>
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
