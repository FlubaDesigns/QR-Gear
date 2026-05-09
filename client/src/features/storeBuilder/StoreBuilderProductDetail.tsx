import { Store, Loader2, LinkIcon, Palette, Ruler, Maximize2, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { getColorHex } from "./store-builder-types";
import { useStoreBuilder } from "./StoreBuilderContext";

export function StoreBuilderProductDetail() {
  const {
    productPackage,
    configuration,
    previewImageUrl,
    packetThumbnails,
    defaultColorHex,
    isEditMode,
    selectedStoreId,
    selectedChannel,
    setLightboxOpen,
    setThumbnailLightbox,
    setGraphicSize,
    toggleSize,
    toggleColor,
  } = useStoreBuilder();

  if (!productPackage) return null;

  return (
    <>
      {isEditMode && (
        <div className="border border-border rounded-md p-3 bg-muted/30">
          <p className="text-sm text-muted-foreground" data-testid="text-edit-mode-warning">
            <strong className="text-foreground">Edit Mode:</strong> Saving will create a new version. Original will remain unchanged.
          </p>
        </div>
      )}

      {productPackage.destinationStoreName && productPackage.destinationChannelName && (
        <div className="border border-border rounded-md p-3 bg-muted/30">
          <p className="text-sm text-muted-foreground" data-testid="text-built-for">
            <Store className="h-4 w-4 inline mr-1" />
            <strong className="text-foreground">Built for:</strong> {productPackage.destinationStoreName} / {productPackage.destinationChannelName}
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
              onClick={() => setLightboxOpen(true)}
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
                    style={{ backgroundColor: thumb.useColorBg ? defaultColorHex : "#f5f5f5" }}
                    onClick={() => setThumbnailLightbox(thumb.url)}
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
              <p><span className="font-medium text-foreground">Brand:</span> {productPackage.manufacturer || "Unknown"}</p>
              <p><span className="font-medium text-foreground">Fulfillment:</span> {productPackage.printProviderId ? "Printify" : "TBD"}</p>
              <p><span className="font-medium text-foreground">Made in:</span> {productPackage.madeIn || "USA"}</p>
            </div>
            {productPackage.qrProductState && (
              <Badge variant="secondary" className="text-xs">
                {productPackage.qrProductState.replace("qr_", "").toUpperCase()}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-3 space-y-2">
        {productPackage.qrContent && (
          <div className="flex items-start gap-2 p-2 bg-muted/40 rounded-md">
            <LinkIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">URL</p>
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

      <CollapsibleModule
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
              onClick={() => setGraphicSize(size)}
              data-testid={`graphic-size-${size}`}
            >
              {size}
            </Button>
          ))}
        </div>
      </CollapsibleModule>

      <CollapsibleModule
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
                onCheckedChange={() => toggleSize(size)}
                data-testid={`toggle-size-${size}`}
              />
            </div>
          ))}
        </div>
      </CollapsibleModule>

      <CollapsibleModule
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
                onCheckedChange={() => toggleColor(color.name)}
                data-testid={`toggle-color-${color.name}`}
              />
            </div>
          ))}
        </div>
      </CollapsibleModule>
    </>
  );
}
