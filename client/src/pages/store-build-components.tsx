import { useState } from "react";
import { Loader2, Check, X, Flag, Star, Globe2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Product } from "@shared/schema";

type ProductConfig = {
  enabledSizes: string[];
  enabledColors: string[];
  defaultColor?: string;
};

interface StoreBuildProductCardProps {
  product: Product;
  config: ProductConfig | undefined;
  enabledSizes: string[];
  enabledColors: string[];
  isSelected: boolean;
  saveStatus: "success" | "error" | null;
  isSaving: boolean;
  onToggleSelect: (checked: boolean) => void;
  onEnlargeImage: (url: string, name: string) => void;
  onOpenOptions: (productId: string, sizes: string[], colorNames: string[]) => void;
  onSetDefaultColor: (productId: string, colorName: string, sizes: string[], colorNames: string[]) => void;
  onSaveToStore: (productId: string, sizes: string[], colors: { name: string; hex: string }[]) => void;
}

export function StoreBuildProductCard({
  product, config, enabledSizes, enabledColors, isSelected, saveStatus, isSaving,
  onToggleSelect, onEnlargeImage, onOpenOptions, onSetDefaultColor, onSaveToStore,
}: StoreBuildProductCardProps) {
  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes as string[] : [];
  const colors = Array.isArray(product.availableColors)
    ? (product.availableColors as Array<{ name: string; hex: string }>)
    : [];

  return (
    <div
      className="w-full max-w-3xl border-2 border-blue-500 rounded-xl p-4 bg-card overflow-hidden"
      data-testid={`product-card-${product.id}`}
    >
      <div className="flex gap-4 items-start">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onToggleSelect(!!checked)}
            className="h-11 w-11 mt-2"
            data-testid={`checkbox-select-${product.id}`}
          />
          {product.imageUrl && (
            <button
              onClick={() => onEnlargeImage(product.imageUrl!, product.name)}
              className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
              data-testid={`button-enlarge-${product.id}`}
            >
              <img
                src={product.imageUrl}
                alt=""
                className="w-28 h-28 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border-2 border-blue-400"
              />
            </button>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-semibold">{product.name}</div>
          <div className="flex items-center gap-2 mt-2 whitespace-nowrap">
            <span className="text-base text-muted-foreground">{product.manufacturer || "Unknown Manufacturer"}</span>
            {product.madeInUSA ? (
              <img
                src="https://flagcdn.com/w40/us.png"
                srcSet="https://flagcdn.com/w80/us.png 2x"
                alt="Made in USA"
                className="h-6 w-auto rounded-sm shadow-sm"
              />
            ) : (
              <Globe2 className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      <div className="-mx-4 mt-4 py-4 px-4 bg-primary/15 border-y-2 border-primary/40">
        <div className="text-xl font-bold text-primary">
          Production Cost: ${product.basePrice}
        </div>
      </div>

      {sizes.length > 0 && (
        <div className="mt-3 py-2 px-4 bg-muted/50 rounded-lg border-2 border-border">
          <div className="text-sm font-medium text-muted-foreground mb-2">Available Sizes:</div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size, idx) => (
              <span
                key={idx}
                className={`px-3 py-1.5 text-sm font-medium rounded-md border-2 ${
                  enabledSizes.includes(size)
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {size}
              </span>
            ))}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div className="mt-3 py-2 px-4 bg-muted/50 rounded-lg border-2 border-border">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Display Color (tap to set default):
          </div>
          <div className="admin-color-picker">
            {colors.map((color, idx) => {
              const isEnabled = enabledColors.includes(color.name);
              const isDefault = config?.defaultColor === color.name;
              return (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSetDefaultColor(product.id, color.name, sizes, colors.map(c => c.name))}
                      className={`admin-color-swatch ${isEnabled ? 'is-enabled' : ''} ${isDefault ? 'is-default' : ''}`}
                      data-testid={`color-swatch-${product.id}-${idx}`}
                    >
                      <div
                        className="admin-color-swatch-inner"
                        style={{ backgroundColor: color.hex || '#ccc' }}
                      />
                      {isDefault && (
                        <Star className="admin-color-swatch-star" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {color.name} {isDefault ? '(Default Display)' : '- Tap to set as default'}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          {config?.defaultColor && (
            <div className="admin-color-default-label">
              <Star />
              Showing: <span className="font-medium">{config.defaultColor}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-4">
        {(sizes.length > 0 || colors.length > 0) && (
          <button
            className="qr-btn qr-btn--lg qr-btn--outline"
            onClick={() => onOpenOptions(product.id, sizes, colors.map(c => c.name))}
            data-testid={`button-options-${product.id}`}
          >
            Change Options
          </button>
        )}
        <button
          className={`qr-btn qr-btn--lg qr-btn--primary ${
            saveStatus === "success" ? "is-success" :
            saveStatus === "error" ? "is-error" :
            isSaving ? "is-loading" : ""
          }`}
          onClick={() => onSaveToStore(product.id, sizes, colors)}
          disabled={isSaving}
          data-testid={`button-save-${product.id}`}
          style={{ minWidth: '140px' }}
        >
          {saveStatus === "success" ? (
            <><Check className="h-5 w-5" /> Saved</>
          ) : saveStatus === "error" ? (
            <><X className="h-5 w-5" /> Error</>
          ) : isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Save to Store"
          )}
        </button>
      </div>
    </div>
  );
}

interface StoreBuildOptionsDialogProps {
  productId: string | null;
  products: Product[] | undefined;
  dialogSizes: string[];
  dialogColors: string[];
  dialogDefaultColor: string | null;
  generatingMockup: string | null;
  onToggleSize: (size: string) => void;
  onToggleColor: (colorName: string) => void;
  onSetDefault: (colorName: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function StoreBuildOptionsDialog({
  productId, products, dialogSizes, dialogColors, dialogDefaultColor,
  generatingMockup, onToggleSize, onToggleColor, onSetDefault, onClose, onSave,
}: StoreBuildOptionsDialogProps) {
  const product = productId ? products?.find(p => p.id === productId) : null;
  const sizes = product ? (Array.isArray(product.availableSizes) ? product.availableSizes as string[] : []) : [];
  const colors = product ? (Array.isArray(product.availableColors)
    ? (product.availableColors as Array<{ name: string; hex: string }>)
    : []) : [];

  return (
    <Dialog open={!!productId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Configure Options</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-6">
            {sizes.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Sizes</div>
                <div className="flex flex-wrap gap-3">
                  {sizes.map(size => (
                    <div key={size} className="flex items-center gap-3 bg-muted px-4 py-3 rounded-lg min-w-[120px]">
                      <Switch
                        checked={dialogSizes.includes(size)}
                        onCheckedChange={() => onToggleSize(size)}
                        className="h-8 w-16"
                        data-testid={`dialog-switch-size-${size}`}
                      />
                      <span className="text-base font-medium">{size}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Colors (switch to enable, tap star to set default)
                </div>
                <div className="flex flex-col gap-3">
                  {colors.map(color => {
                    const isEnabled = dialogColors.includes(color.name);
                    const isDefault = dialogDefaultColor === color.name;
                    return (
                      <div key={color.name} className="dialog-color-row">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => onToggleColor(color.name)}
                          className="dialog-color-switch"
                          data-testid={`dialog-switch-color-${color.name}`}
                        />
                        <div className="dialog-color-swatch" style={{ backgroundColor: color.hex }} />
                        <span className="dialog-color-name">{color.name}</span>
                        <button
                          type="button"
                          onClick={() => onSetDefault(color.name)}
                          disabled={!isEnabled || generatingMockup !== null}
                          className={`dialog-default-btn ${isDefault ? 'is-default' : ''} ${!isEnabled ? 'is-disabled' : ''} ${generatingMockup === color.name ? 'is-loading' : ''}`}
                          data-testid={`dialog-default-${color.name}`}
                        >
                          {generatingMockup === color.name ? (
                            <Loader2 className="dialog-default-star animate-spin" />
                          ) : (
                            <Star className="dialog-default-star" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {dialogDefaultColor && (
                  <div className="dialog-default-label">
                    <Star className="dialog-default-label-star" />
                    Default: <span className="font-semibold">{dialogDefaultColor}</span>
                  </div>
                )}
              </div>
            )}

            {sizes.length === 0 && colors.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                This product has no size or color options to configure.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-3 mt-6">
          <button className="qr-btn qr-btn--lg qr-btn--outline" onClick={onClose} data-testid="button-dialog-cancel">
            Cancel
          </button>
          <button className="qr-btn qr-btn--lg qr-btn--primary" onClick={onSave} data-testid="button-dialog-save">
            <Check className="h-5 w-5" />
            Save Options
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
