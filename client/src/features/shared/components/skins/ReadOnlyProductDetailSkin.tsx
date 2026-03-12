import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Package, Palette, Ruler, X } from "lucide-react";
import { resolvePublicDescription } from "@shared/descriptionLayers";
import type { AllowedProduct } from "@/features/shared/components/wizardSteps/wizardTypes";

export interface ReadOnlyProductDetailSkinProps {
  product: AllowedProduct;
  onSelect: (product: AllowedProduct) => void;
  onClose: () => void;
}

export function ReadOnlyProductDetailSkin({ product, onSelect, onClose }: ReadOnlyProductDetailSkinProps) {
  const description = resolvePublicDescription({
    adminCatalogDescription: product.adminCatalogDescription || null,
    providerDescription: product.providerDescription || product.description || null,
  }) || product.effectiveDescription || product.description || "No description available";

  const colorList = product.availableColors || [];
  const sizeList = product.availableSizes || product.sizes || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="overlay-readonly-product-detail"
    >
      <div
        className="relative w-[90vw] max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-90 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-black/50 rounded-full p-1.5"
          data-testid="button-close-detail"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="bg-white rounded-t-2xl p-4 flex items-center justify-center min-h-[200px]">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="max-h-[40vh] w-auto object-contain"
            />
          ) : (
            <Package className="w-16 h-16 text-slate-400" />
          )}
        </div>

        <div className="p-4 space-y-3">
          <h3 className="text-lg font-bold text-white">{product.title}</h3>

          {product.retailPrice != null && (
            <span className="text-2xl font-bold text-emerald-400">${product.retailPrice.toFixed(2)}</span>
          )}

          {product.brand && (
            <p className="text-xs text-slate-400">{product.brand}</p>
          )}

          <p className="text-sm text-slate-300">{description}</p>

          {colorList.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Palette className="w-3 h-3" />
                {colorList.length} colors
              </p>
              <div className="flex flex-wrap gap-1.5">
                {colorList.map((c, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border border-slate-600"
                    style={{ backgroundColor: c.hex || "#888" }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}

          {sizeList.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Ruler className="w-3 h-3" />
                Sizes
              </p>
              <div className="flex flex-wrap gap-1">
                {sizeList.map((s: string) => (
                  <Badge key={s} variant="outline" className="text-xs text-slate-300 border-slate-600">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {product.placements && product.placements.length > 0 && (
            <p className="text-xs text-slate-400">
              Print areas: {product.placements.map((pl: any) => pl.title || pl.id).join(", ")}
            </p>
          )}

          <Button
            onClick={() => {
              onSelect(product);
              onClose();
            }}
            className="w-full bg-green-600 text-white min-h-12 text-base"
            data-testid="button-detail-select"
          >
            <Check className="w-4 h-4 mr-2" />
            Select This Product
          </Button>
        </div>
      </div>
    </div>
  );
}
