import { useState, useEffect } from "react";
import { Store, Building2, Globe, ChevronRight, Loader2, Package, QrCode, Link as LinkIcon, Palette, Ruler, Maximize2, Image, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import type { PartnerStore } from "@shared/schema";

interface ProductColor {
  hex: string;
  name: string;
}

interface ProductPackage {
  packetId?: string;
  templateId?: string;
  graphicsId?: string;
  qrContent?: string;
  productName?: string;
  productDescription?: string;
  productImageUrl?: string;
  compositeUrl?: string;
  qrOnlyUrl?: string;
  headerText?: string;
  footerText?: string;
  colors?: ProductColor[];
  sizes?: string[];
  qrSizes?: string[];
  availablePlacements?: string[];
  placements?: string[];
  basePrice?: string;
  customerPrice?: string;
  qrProductState?: string;
  blueprintId?: number;
  printProviderId?: number;
  pricing?: {
    baseProductCost: number;
    placementCost: number;
    textUpcharge: number;
    hostingCost: number;
    subtotal: number;
    markupAmount: number;
    customerPrice: number;
    hostingTierCode?: string;
  };
}

interface ProductConfiguration {
  enabledColors: Set<string>;
  enabledSizes: Set<string>;
  enabledQrSizes: Set<string>;
  defaultColor: string;
  defaultQrSize: string;
}

type StoreType = "internal" | "external" | null;

function PackagePreviewModule({ productPackage, isLoading }: { productPackage: ProductPackage | null; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <CollapsibleModule
        title="Product Package"
        icon={<Package className="h-4 w-4" />}
        className="bg-muted/30"
        defaultOpen
      >
        <div className="p-4 text-center flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading package from database...</span>
        </div>
      </CollapsibleModule>
    );
  }

  if (!productPackage) {
    return (
      <CollapsibleModule
        title="Product Package"
        icon={<Package className="h-4 w-4" />}
        className="bg-muted/30"
        defaultOpen
      >
        <div className="p-4 text-center glass-button rounded-lg">
          <p className="glass-body" data-testid="text-no-package">
            No product package loaded. Save a product from the Products Builder first.
          </p>
        </div>
      </CollapsibleModule>
    );
  }

  return (
    <CollapsibleModule
      title="Product Package"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {productPackage.productName && (
          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-lg font-semibold" data-testid="text-product-name">
              {productPackage.productName}
            </p>
            {productPackage.productDescription && (
              <p className="text-sm text-muted-foreground mt-1">
                {productPackage.productDescription}
              </p>
            )}
            {productPackage.qrProductState && (
              <Badge variant="secondary" className="mt-2">
                {productPackage.qrProductState.replace('qr_', '').toUpperCase()}
              </Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {(productPackage.productImageUrl || productPackage.compositeUrl) && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Product Image</p>
              <img
                src={productPackage.productImageUrl || productPackage.compositeUrl}
                alt="Product"
                className="w-full h-32 object-contain rounded-lg border"
                data-testid="img-composite"
              />
            </div>
          )}
          {productPackage.qrOnlyUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">QR Code</p>
              <img
                src={productPackage.qrOnlyUrl}
                alt="QR Code"
                className="w-full h-32 object-contain rounded-lg border bg-white"
                data-testid="img-qr-only"
              />
            </div>
          )}
        </div>

        {productPackage.qrContent && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 flex-shrink-0 text-blue-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">QR Content (URL/Text)</p>
                <p className="text-sm font-mono break-all" data-testid="text-qr-content">
                  {productPackage.qrContent}
                </p>
              </div>
            </div>
          </div>
        )}

        {(productPackage.headerText || productPackage.footerText) && (
          <div className="p-3 bg-purple-50 dark:bg-purple-950/50 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">Custom Text</p>
            {productPackage.headerText && (
              <p className="text-sm"><span className="font-medium">Header:</span> {productPackage.headerText}</p>
            )}
            {productPackage.footerText && (
              <p className="text-sm"><span className="font-medium">Footer:</span> {productPackage.footerText}</p>
            )}
          </div>
        )}

        {productPackage.colors && productPackage.colors.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium mb-2">Available Colors ({productPackage.colors.length})</p>
            <div className="flex flex-wrap gap-2">
              {productPackage.colors.map((color, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-1 px-2 py-1 bg-background rounded border text-xs"
                  data-testid={`color-${idx}`}
                >
                  <div 
                    className="w-4 h-4 rounded-full border" 
                    style={{ backgroundColor: color.hex }}
                  />
                  <span>{color.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {productPackage.sizes && productPackage.sizes.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium mb-2">Available Sizes ({productPackage.sizes.length})</p>
            <div className="flex flex-wrap gap-1">
              {productPackage.sizes.map((size, idx) => (
                <Badge key={idx} variant="outline" className="text-xs" data-testid={`size-${idx}`}>
                  {size}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {productPackage.placements && productPackage.placements.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium mb-2">Selected Placements</p>
            <div className="flex flex-wrap gap-1">
              {productPackage.placements.map((placement, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs capitalize">
                  {placement}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {productPackage.pricing && (
          <div className="p-3 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">Pricing Breakdown</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Base Price</span>
                <span>${productPackage.pricing.baseProductCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Extra Placements</span>
                <span>{productPackage.pricing.placementCost > 0 ? `+$${productPackage.pricing.placementCost.toFixed(2)}` : '$0.00'}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Text Lines</span>
                <span>{productPackage.pricing.textUpcharge > 0 ? `+$${productPackage.pricing.textUpcharge.toFixed(2)}` : '$0.00'}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Hosting</span>
                <span>{productPackage.pricing.hostingCost > 0 ? `+$${productPackage.pricing.hostingCost.toFixed(2)}` : '$0.00'}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span>Subtotal</span>
                <span>${productPackage.pricing.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Markup</span>
                <span>+${productPackage.pricing.markupAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold text-green-700 dark:text-green-300">
                <span>Customer Price</span>
                <span>${productPackage.pricing.customerPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {productPackage.packetId && (
            <Badge variant="secondary" data-testid="badge-packet">
              Packet: {productPackage.packetId.slice(0, 8)}...
            </Badge>
          )}
          {productPackage.templateId && (
            <Badge variant="outline" data-testid="badge-template">
              Template: {productPackage.templateId.slice(0, 8)}...
            </Badge>
          )}
          {productPackage.graphicsId && (
            <Badge variant="outline" data-testid="badge-graphics">
              Graphics: {productPackage.graphicsId.slice(0, 8)}...
            </Badge>
          )}
        </div>
      </div>
    </CollapsibleModule>
  );
}

function ProductConfigurationModule({ 
  productPackage,
  configuration,
  onConfigurationChange,
}: { 
  productPackage: ProductPackage | null;
  configuration: ProductConfiguration;
  onConfigurationChange: (config: ProductConfiguration) => void;
}) {
  if (!productPackage) {
    return null;
  }

  const availableColors = productPackage.colors || [];
  const availableSizes = productPackage.sizes || [];
  const availableQrSizes = productPackage.qrSizes || ["small", "medium", "large"];

  const toggleColor = (colorName: string) => {
    const newColors = new Set(configuration.enabledColors);
    if (newColors.has(colorName)) {
      if (newColors.size > 1) newColors.delete(colorName);
    } else {
      newColors.add(colorName);
    }
    let newDefault = configuration.defaultColor;
    if (!newColors.has(newDefault)) {
      newDefault = Array.from(newColors)[0] || "";
    }
    onConfigurationChange({ ...configuration, enabledColors: newColors, defaultColor: newDefault });
  };

  const toggleSize = (size: string) => {
    const newSizes = new Set(configuration.enabledSizes);
    if (newSizes.has(size)) {
      if (newSizes.size > 1) newSizes.delete(size);
    } else {
      newSizes.add(size);
    }
    onConfigurationChange({ ...configuration, enabledSizes: newSizes });
  };

  const toggleQrSize = (qrSize: string) => {
    const newQrSizes = new Set(configuration.enabledQrSizes);
    if (newQrSizes.has(qrSize)) {
      if (newQrSizes.size > 1) newQrSizes.delete(qrSize);
    } else {
      newQrSizes.add(qrSize);
    }
    onConfigurationChange({ ...configuration, enabledQrSizes: newQrSizes });
  };

  const setDefaultColor = (colorName: string) => {
    onConfigurationChange({ ...configuration, defaultColor: colorName });
  };

  const setDefaultQrSize = (qrSize: string) => {
    onConfigurationChange({ ...configuration, defaultQrSize: qrSize });
  };

  const toggleAllColors = (enable: boolean) => {
    const newColors = enable 
      ? new Set(availableColors.map(c => c.name))
      : new Set([availableColors[0]?.name || ""]);
    onConfigurationChange({ 
      ...configuration, 
      enabledColors: newColors,
      defaultColor: enable ? configuration.defaultColor : (availableColors[0]?.name || "")
    });
  };

  const toggleAllSizes = (enable: boolean) => {
    const newSizes = enable
      ? new Set(availableSizes)
      : new Set([availableSizes[0] || ""]);
    onConfigurationChange({ ...configuration, enabledSizes: newSizes });
  };

  return (
    <div className="space-y-4">
      {/* SECTION 1: Customer Options - What customers can choose */}
      <CollapsibleModule
        title="Step 1: Customer Options"
        icon={<Palette className="h-4 w-4" />}
        className="bg-muted/30"
        defaultOpen
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Toggle which options customers can choose from when ordering.
          </p>

          {/* Available Colors */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <h5 className="text-sm font-medium">Available Colors</h5>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {configuration.enabledColors.size}/{availableColors.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => toggleAllColors(configuration.enabledColors.size < availableColors.length)}
                  data-testid="button-toggle-all-colors"
                >
                  {configuration.enabledColors.size < availableColors.length ? "All" : "Min"}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {availableColors.map((color) => (
                <div
                  key={color.name}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all ${
                    configuration.enabledColors.has(color.name)
                      ? "bg-primary/10 border-primary"
                      : "bg-background hover-elevate"
                  }`}
                  onClick={() => toggleColor(color.name)}
                  data-testid={`toggle-color-${color.name}`}
                >
                  <div
                    className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                    style={{ backgroundColor: color.hex, borderColor: color.hex === "#FFFFFF" ? "#ccc" : color.hex }}
                  />
                  <span className="text-sm">{color.name}</span>
                  <Switch
                    checked={configuration.enabledColors.has(color.name)}
                    onCheckedChange={() => toggleColor(color.name)}
                    className="ml-auto"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Available Sizes */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                <h5 className="text-sm font-medium">Available Sizes</h5>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {configuration.enabledSizes.size}/{availableSizes.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => toggleAllSizes(configuration.enabledSizes.size < availableSizes.length)}
                  data-testid="button-toggle-all-sizes"
                >
                  {configuration.enabledSizes.size < availableSizes.length ? "All" : "Min"}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((size) => (
                <div
                  key={size}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all ${
                    configuration.enabledSizes.has(size)
                      ? "bg-primary/10 border-primary"
                      : "bg-background hover-elevate"
                  }`}
                  onClick={() => toggleSize(size)}
                  data-testid={`toggle-size-${size}`}
                >
                  <span className="text-sm font-medium">{size}</span>
                  <Switch
                    checked={configuration.enabledSizes.has(size)}
                    onCheckedChange={() => toggleSize(size)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Available Graphic Sizes */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                <h5 className="text-sm font-medium">Available Graphic Sizes</h5>
              </div>
              <Badge variant="outline" className="text-xs">
                {configuration.enabledQrSizes.size}/{availableQrSizes.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableQrSizes.map((qrSize) => (
                <div
                  key={qrSize}
                  className={`flex items-center gap-2 px-4 py-3 rounded-md border cursor-pointer transition-all ${
                    configuration.enabledQrSizes.has(qrSize)
                      ? "bg-primary/10 border-primary"
                      : "bg-background hover-elevate"
                  }`}
                  onClick={() => toggleQrSize(qrSize)}
                  data-testid={`toggle-qr-${qrSize}`}
                >
                  <QrCode className={`h-${qrSize === "small" ? "4" : qrSize === "medium" ? "5" : "6"} w-${qrSize === "small" ? "4" : qrSize === "medium" ? "5" : "6"}`} />
                  <span className="text-sm font-medium capitalize">{qrSize}</span>
                  <Switch
                    checked={configuration.enabledQrSizes.has(qrSize)}
                    onCheckedChange={() => toggleQrSize(qrSize)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleModule>

      {/* SECTION 2: Hero Image Settings - What's shown by default */}
      <CollapsibleModule
        title="Step 2: Hero Image Settings"
        icon={<Image className="h-4 w-4" />}
        className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-2 border-purple-200 dark:border-purple-800"
        defaultOpen
      >
        <div className="space-y-4">
          <p className="text-sm text-purple-700 dark:text-purple-300">
            Choose which color and graphic size will be shown as the main product image to customers.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Default Color */}
            <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
              <p className="text-sm font-medium mb-3">Default Color</p>
              {configuration.enabledColors.size > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from(configuration.enabledColors).map((colorName) => {
                    const colorObj = availableColors.find(c => c.name === colorName);
                    return (
                      <button
                        key={colorName}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          configuration.defaultColor === colorName 
                            ? "ring-2 ring-offset-2 ring-purple-500 border-purple-500" 
                            : "border-gray-300 hover:border-purple-400"
                        }`}
                        style={{ backgroundColor: colorObj?.hex || "#ccc" }}
                        onClick={() => setDefaultColor(colorName)}
                        title={colorName}
                        data-testid={`hero-color-${colorName}`}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Enable colors in Step 1 first</p>
              )}
              {configuration.defaultColor && (
                <p className="text-xs mt-2 text-purple-600 dark:text-purple-400 font-medium">
                  Selected: {configuration.defaultColor}
                </p>
              )}
            </div>

            {/* Default Graphic Size */}
            <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg">
              <p className="text-sm font-medium mb-3">Default Graphic Size</p>
              {configuration.enabledQrSizes.size > 0 ? (
                <div className="flex gap-2">
                  {Array.from(configuration.enabledQrSizes).map((qrSize) => (
                    <Button
                      key={qrSize}
                      variant={configuration.defaultQrSize === qrSize ? "default" : "outline"}
                      size="sm"
                      className={`capitalize ${configuration.defaultQrSize === qrSize ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                      onClick={() => setDefaultQrSize(qrSize)}
                      data-testid={`hero-qr-${qrSize}`}
                    >
                      {qrSize}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Enable sizes in Step 1 first</p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
            <p className="text-sm">
              <span className="font-medium">Hero image will show:</span>{" "}
              <span className="text-purple-700 dark:text-purple-300">
                {configuration.defaultColor || "No color"} / {configuration.defaultQrSize || "No size"}
              </span>
            </p>
          </div>
        </div>
      </CollapsibleModule>
    </div>
  );
}

interface MockupJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  color?: string;
  size?: string;
  placement?: string;
  mockupUrl?: string | null;
  error?: string | null;
}

function MockupsModule({ templateId }: { templateId?: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data: mockupsData, isLoading, refetch } = useQuery<{
    success: boolean;
    summary: { total: number; completed: number; pending: number; processing: number; failed: number };
    mockups: MockupJob[];
  }>({
    queryKey: ["/api/test/templates", templateId, "mockups"],
    queryFn: async () => {
      if (!templateId) return { success: false, summary: { total: 0, completed: 0, pending: 0, processing: 0, failed: 0 }, mockups: [] };
      const res = await fetch(`/api/test/templates/${templateId}/mockups`);
      return res.json();
    },
    enabled: !!templateId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (!templateId) {
    return null;
  }

  const summary = mockupsData?.summary || { total: 0, completed: 0, pending: 0, processing: 0, failed: 0 };
  const mockups = mockupsData?.mockups || [];
  const completedMockups = mockups.filter(m => m.status === "completed" && m.mockupUrl);

  return (
    <CollapsibleModule
      title="Step 3: Preview Mockups"
      icon={<Image className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        {/* Status Bar */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{summary.completed} completed</span>
            </div>
            {summary.pending > 0 && (
              <div className="flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>{summary.pending + summary.processing} pending</span>
              </div>
            )}
            {summary.failed > 0 && (
              <div className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span>{summary.failed} failed</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            data-testid="button-refresh-mockups"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Mockup Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading mockups...</span>
          </div>
        ) : completedMockups.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {completedMockups.map((mockup) => (
              <div
                key={mockup.id}
                className="relative rounded-lg border overflow-hidden bg-white"
                data-testid={`mockup-${mockup.id}`}
              >
                <img
                  src={mockup.mockupUrl!}
                  alt={`${mockup.color} - ${mockup.size}`}
                  className="w-full h-32 object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                  {mockup.color} • {mockup.placement}
                </div>
              </div>
            ))}
          </div>
        ) : summary.pending > 0 || summary.processing > 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Mockups are being generated...</p>
            <p className="text-xs">This may take a few minutes. The page will auto-refresh.</p>
          </div>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            <p>No mockups generated yet.</p>
          </div>
        )}

        {/* Failed Jobs */}
        {summary.failed > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
              {summary.failed} mockup(s) failed to generate
            </p>
            <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
              {mockups.filter(m => m.status === "failed").slice(0, 3).map(m => (
                <p key={m.id}>{m.color}: {m.error || "Unknown error"}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}

function StoreAssignmentModule({ 
  onStoreSelect,
  isSaving,
  productPackage,
}: { 
  onStoreSelect: (store: PartnerStore, channel: string) => void;
  isSaving: boolean;
  productPackage: ProductPackage | null;
}) {
  const { apiBase } = useAdminAuth();
  
  const [selectedType, setSelectedType] = useState<StoreType>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const { data: stores = [], isLoading } = useQuery<PartnerStore[]>({
    queryKey: [`${apiBase}/partner-stores`],
  });

  const filteredStores = stores.filter((store) => {
    if (selectedType === "internal") return store.isInternal === true;
    if (selectedType === "external") return store.isInternal === false;
    return true;
  });

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const channels = selectedStore?.availableSegments || [];

  const handleConfirm = () => {
    if (selectedStore && selectedChannel) {
      onStoreSelect(selectedStore, selectedChannel);
    }
  };

  const storeOptions = filteredStores.map(store => ({
    value: store.id,
    label: store.name,
    icon: <Store className="h-4 w-4 flex-shrink-0" />,
  }));

  const canConfirm = selectedStore && selectedChannel && productPackage;

  return (
    <CollapsibleModule
      title="Step 4: Assign to Store"
      icon={<Store className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Store Type</p>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className={`p-4 cursor-pointer hover-elevate transition-all ${
                selectedType === "internal"
                  ? "ring-2 ring-primary bg-primary/10"
                  : ""
              }`}
              onClick={() => {
                setSelectedType("internal");
                setSelectedStoreId(null);
                setSelectedChannel(null);
              }}
              data-testid="store-type-internal"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <Building2 className="h-6 w-6" />
                <span className="font-medium">Internal</span>
                <span className="text-xs text-muted-foreground">QR Gear stores</span>
              </div>
            </Card>
            <Card
              className={`p-4 cursor-pointer hover-elevate transition-all ${
                selectedType === "external"
                  ? "ring-2 ring-primary bg-primary/10"
                  : ""
              }`}
              onClick={() => {
                setSelectedType("external");
                setSelectedStoreId(null);
                setSelectedChannel(null);
              }}
              data-testid="store-type-external"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <Globe className="h-6 w-6" />
                <span className="font-medium">External</span>
                <span className="text-xs text-muted-foreground">Partner stores</span>
              </div>
            </Card>
          </div>
        </div>

        {selectedType && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Select Store</p>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading stores...</p>
            ) : filteredStores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {selectedType} stores found
              </p>
            ) : (
              <CustomDropdown
                value={selectedStoreId || ""}
                onChange={(val) => {
                  setSelectedStoreId(val);
                  setSelectedChannel(null);
                }}
                options={storeOptions}
                placeholder="Choose a store..."
                data-testid="store-select"
              />
            )}
          </div>
        )}

        {selectedStore && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Select Channel</p>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No channels available for this store
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <Badge
                    key={channel}
                    variant={selectedChannel === channel ? "default" : "outline"}
                    className={`cursor-pointer h-10 px-4 text-sm ${
                      selectedChannel === channel ? "" : "hover-elevate"
                    }`}
                    onClick={() => setSelectedChannel(channel)}
                    data-testid={`channel-${channel}`}
                  >
                    {channel}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {canConfirm && (
          <div className="pt-2 border-t space-y-3">
            <div className="p-3 bg-primary/5 rounded-md">
              <p className="text-sm">
                <span className="font-medium">Assigning to: </span>
                {selectedStore.name} &rarr; {selectedChannel}
              </p>
            </div>
            <Button
              className="w-full h-12"
              onClick={handleConfirm}
              disabled={isSaving}
              data-testid="confirm-store-assignment"
            >
              {isSaving ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Store className="h-5 w-5 mr-2" />
              )}
              {isSaving ? "Assigning..." : `Assign to ${selectedChannel}`}
              {!isSaving && <ChevronRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        )}

        {!productPackage && selectedStore && selectedChannel && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Load a product package first before assigning to a store.
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}

export function StoreBuilderHarness() {
  const [productPackage, setProductPackage] = useState<ProductPackage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPacket, setIsLoadingPacket] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [configuration, setConfiguration] = useState<ProductConfiguration>({
    enabledColors: new Set<string>(),
    enabledSizes: new Set<string>(),
    enabledQrSizes: new Set<string>(["small", "medium", "large"]),
    defaultColor: "",
    defaultQrSize: "medium",
  });

  // Initialize configuration when package loads
  useEffect(() => {
    if (productPackage) {
      const colors = productPackage.colors?.map(c => c.name) || [];
      const sizes = productPackage.sizes || [];
      const qrSizes = productPackage.qrSizes || ["small", "medium", "large"];
      
      setConfiguration({
        enabledColors: new Set(colors),
        enabledSizes: new Set(sizes),
        enabledQrSizes: new Set(qrSizes),
        defaultColor: colors[0] || "",
        defaultQrSize: "medium",
      });
    }
  }, [productPackage]);

  useEffect(() => {
    // Check for packetId in URL first
    const urlParams = new URLSearchParams(window.location.search);
    const packetId = urlParams.get("packetId");
    
    if (packetId) {
      setIsLoadingPacket(true);
      fetch(`/api/test/packets/${packetId}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data.success && data.packet) {
            const packet = data.packet;
            setProductPackage({
              packetId: packet.id,
              templateId: packet.templateId || null,
              qrContent: packet.qrContent,
              productName: packet.productName,
              productDescription: packet.productDescription,
              productImageUrl: packet.productImageUrl,
              compositeUrl: packet.compositeUrl,
              qrOnlyUrl: packet.qrOnlyUrl,
              headerText: packet.headerText,
              footerText: packet.footerText,
              colors: packet.colors || [],
              sizes: packet.sizes || [],
              qrSizes: packet.qrSizes || ["small", "medium", "large"],
              availablePlacements: packet.availablePlacements || [],
              placements: packet.placements || [],
              basePrice: packet.basePrice,
              customerPrice: packet.customerPrice,
              qrProductState: packet.qrProductState,
              blueprintId: packet.blueprintId,
              printProviderId: packet.printProviderId,
              pricing: packet.pricing,
            });
          }
        })
        .catch(err => {
          console.error("Failed to load packet:", err);
          setSaveStatus({ type: "error", message: `Failed to load packet: ${err.message}` });
        })
        .finally(() => {
          setIsLoadingPacket(false);
        });
      return;
    }

    // Fallback to sessionStorage
    const savedPackage = sessionStorage.getItem("productPackage");
    if (savedPackage) {
      try {
        const parsed = JSON.parse(savedPackage);
        // Validate package has at least one ID for linking
        if (!parsed.templateId && !parsed.graphicsId && !parsed.packetId) {
          console.warn("Stale package without IDs found, clearing");
          sessionStorage.removeItem("productPackage");
          setProductPackage(null);
        } else {
          setProductPackage(parsed);
        }
      } catch (e) {
        console.error("Failed to parse product package:", e);
        sessionStorage.removeItem("productPackage");
      }
    }
  }, []);

  const handleStoreSelect = async (store: PartnerStore, channel: string) => {
    if (!productPackage) return;
    
    // Validate package has required IDs (packetId, templateId, or graphicsId)
    if (!productPackage.packetId && !productPackage.templateId && !productPackage.graphicsId) {
      setSaveStatus({
        type: "error",
        message: "Package missing IDs. Please use 'Create Graphics' in Products Builder first.",
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const response = await fetch("/api/test/store-product-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          storeName: store.name,
          channel,
          packetId: productPackage.packetId,
          templateId: productPackage.templateId,
          graphicsId: productPackage.graphicsId,
          qrContent: productPackage.qrContent,
          productName: productPackage.productName,
          compositeUrl: productPackage.compositeUrl,
          qrOnlyUrl: productPackage.qrOnlyUrl,
          pricing: productPackage.pricing,
          enabledColors: Array.from(configuration.enabledColors),
          enabledSizes: Array.from(configuration.enabledSizes),
          enabledQrSizes: Array.from(configuration.enabledQrSizes),
          defaultColor: configuration.defaultColor,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign to store");
      }

      const result = await response.json();
      setSaveStatus({
        type: "success",
        message: `Linked to ${store.name} / ${channel}`,
      });
      
      sessionStorage.removeItem("productPackage");
      setProductPackage(null);
    } catch (error: any) {
      setSaveStatus({
        type: "error",
        message: error.message || "Failed to assign to store",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PackagePreviewModule productPackage={productPackage} isLoading={isLoadingPacket} />
      <ProductConfigurationModule
        productPackage={productPackage}
        configuration={configuration}
        onConfigurationChange={setConfiguration}
      />
      <MockupsModule templateId={productPackage?.templateId} />
      <StoreAssignmentModule
        onStoreSelect={handleStoreSelect}
        isSaving={isSaving}
        productPackage={productPackage}
      />

      {saveStatus && (
        <div
          className={`p-3 rounded-md border flex items-center gap-2 ${
            saveStatus.type === "success"
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
          }`}
          data-testid="store-save-status"
        >
          <span className="text-sm font-medium">{saveStatus.message}</span>
        </div>
      )}
    </div>
  );
}
