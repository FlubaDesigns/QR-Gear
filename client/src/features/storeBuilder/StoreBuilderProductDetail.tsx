import { Store, Loader2, LinkIcon, Palette, Ruler, Maximize2, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getColorHex, type ProductPackage, type ProductConfiguration } from "./store-builder-types";
import { CollapsibleSection } from "./StoreBuilderComponents";

interface StoreBuilderProductDetailProps {
  productPackage: ProductPackage;
  configuration: ProductConfiguration;
  previewImageUrl: string | undefined;
  packetThumbnails: Array<{ url: string; useColorBg?: boolean }>;
  defaultColorHex: string;
  isEditMode: boolean;
  selectedStoreId: string | null;
  selectedChannel: string | null;
  onLightboxOpen: () => void;
  onThumbnailClick: (url: string) => void;
  onGraphicSizeChange: (size: string) => void;
  onToggleSize: (size: string) => void;
  onToggleColor: (colorName: string) => void;
}

export function StoreBuilderProductDetail({
  productPackage, configuration, previewImageUrl, packetThumbnails,
  defaultColorHex, isEditMode, selectedStoreId, selectedChannel,
  onLightboxOpen, onThumbnailClick, onGraphicSizeChange,
  onToggleSize, onToggleColor,
}: StoreBuilderProductDetailProps) {
  return (
    <>
      {isEditMode && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200" data-testid="text-edit-mode-warning">
            <strong>Edit Mode:</strong> Saving will create a new version. Original will remain unchanged.
          </p>
        </div>
      )}

      {productPackage.destinationStoreName && productPackage.destinationChannelName && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-800 dark:text-blue-200" data-testid="text-built-for">
            <Store className="h-4 w-4 inline mr-1" />
            <strong>Built for:</strong> {productPackage.destinationStoreName} / {productPackage.destinationChannelName}
            {selectedStoreId === productPackage.destinationStoreId &&
             selectedChannel === productPackage.destinationChannelName && (
              <Badge variant="secondary" className="ml-2 text-xs">
                <Check className="h-3 w-3 mr-1" />
                Ready to assign
              </Badge>
            )}
          </p>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-3 p-3">
          <div className="space-y-2">
            <button
              type="button"
              onClick={onLightboxOpen}
              className="w-full aspect-square bg-muted rounded-lg overflow-hidden hover-elevate relative group"
              data-testid="button-open-lightbox"
            >
              {previewImageUrl ? (
                <img src={previewImageUrl} alt="Product preview" className="w-full h-full object-contain" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-sm font-medium">Tap to set hero</span>
              </div>
            </button>

            {packetThumbnails.length > 0 && (
              <div className="flex gap-1">
                {packetThumbnails.slice(0, 3).map((thumb, idx) => (
                  <button
                    type="button"
                    key={idx}
                    className="flex-1 aspect-square rounded overflow-hidden border hover-elevate cursor-pointer"
                    style={{ backgroundColor: thumb.useColorBg ? defaultColorHex : '#f5f5f5' }}
                    onClick={() => onThumbnailClick(thumb.url)}
                    data-testid={`thumb-${idx}`}
                  >
                    <img src={thumb.url} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold text-base leading-tight" data-testid="text-product-name">
              {productPackage.productName || "Untitled Product"}
            </h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><span className="font-medium">Brand:</span> {productPackage.manufacturer || "Unknown"}</p>
              <p><span className="font-medium">Fulfillment:</span> {productPackage.printProviderId ? "Printify" : "TBD"}</p>
              <p><span className="font-medium">Made in:</span> {productPackage.madeIn || "USA"}</p>
            </div>
            {productPackage.qrProductState && (
              <Badge variant="secondary" className="text-xs">
                {productPackage.qrProductState.replace('qr_', '').toUpperCase()}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        {productPackage.qrContent && (
          <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/50 rounded-md">
            <LinkIcon className="h-4 w-4 flex-shrink-0 text-blue-600 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">URL</p>
              <p className="text-sm font-mono break-all" data-testid="text-url">{productPackage.qrContent}</p>
            </div>
          </div>
        )}
        {productPackage.headerText && (
          <div className="p-2 bg-muted/50 rounded-md">
            <p className="text-xs font-medium text-muted-foreground">Header</p>
            <p className="text-sm" data-testid="text-header">{productPackage.headerText}</p>
          </div>
        )}
        {productPackage.footerText && (
          <div className="p-2 bg-muted/50 rounded-md">
            <p className="text-xs font-medium text-muted-foreground">Footer</p>
            <p className="text-sm" data-testid="text-footer">{productPackage.footerText}</p>
          </div>
        )}
      </Card>

      {productPackage.pricing && (
        <Card className="p-3">
          <h3 className="font-medium text-sm mb-2">Pricing</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Provider Cost</span>
              <span className="text-base">${productPackage.pricing.baseProductCost.toFixed(2)}</span>
            </div>
            {productPackage.pricing.placementCost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Placements</span>
                <span>+${productPackage.pricing.placementCost.toFixed(2)}</span>
              </div>
            )}
            {productPackage.pricing.textUpcharge > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Text</span>
                <span>+${productPackage.pricing.textUpcharge.toFixed(2)}</span>
              </div>
            )}
            {productPackage.pricing.hostingCost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Hosting</span>
                <span>+${productPackage.pricing.hostingCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1">
              <span>Subtotal</span>
              <span className="font-medium">${productPackage.pricing.subtotal.toFixed(2)}</span>
            </div>
            <div className="bg-muted/50 rounded px-2 py-1 -mx-1 space-y-1">
              <div className="flex justify-between">
                <span>Your Markup</span>
                <span className="font-bold">{productPackage.pricing.markupPercent || 0}%</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Calculated</span>
                <span>+${productPackage.pricing.markupAmount.toFixed(2)}</span>
              </div>
              {(productPackage.pricing.markupFixed || 0) > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fixed markup</span>
                  <span>+${productPackage.pricing.markupFixed.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between border-t pt-1 font-bold text-base">
              <span>Customer Price</span>
              <span>${productPackage.pricing.customerPrice.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      )}

      <CollapsibleSection
        title="Graphic Size"
        icon={<Maximize2 className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="flex gap-2">
          {["small", "medium", "large"].map(size => (
            <Button
              key={size}
              variant={configuration.selectedGraphicSize === size ? "default" : "outline"}
              size="sm"
              className="flex-1 capitalize"
              onClick={() => onGraphicSizeChange(size)}
              data-testid={`graphic-size-${size}`}
            >
              {size}
            </Button>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Item Sizes"
        icon={<Ruler className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          {(productPackage.sizes || []).map(size => (
            <div key={size} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <span className="font-medium text-sm">{size}</span>
              <Switch
                checked={configuration.enabledSizes.has(size)}
                onCheckedChange={() => onToggleSize(size)}
                data-testid={`toggle-size-${size}`}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Colors"
        icon={<Palette className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          {(productPackage.colors || []).map(color => (
            <div key={color.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: getColorHex(color) }} />
                <span className="font-medium text-sm">{color.name}</span>
              </div>
              <Switch
                checked={configuration.enabledColors.has(color.name)}
                onCheckedChange={() => onToggleColor(color.name)}
                data-testid={`toggle-color-${color.name}`}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </>
  );
}
