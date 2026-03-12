import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, DollarSign, Package, Palette, Ruler, Pencil, X } from "lucide-react";
import { resolveDescription } from "@shared/descriptionLayers";
import type { AllowedProduct } from "@/features/shared/components/wizardSteps/wizardTypes";

export interface MemberProductDetailSkinProps {
  product: AllowedProduct;
  onSelect: (product: AllowedProduct) => void;
  onClose: () => void;
}

export function MemberProductDetailSkin({ product, onSelect, onClose }: MemberProductDetailSkinProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [localProduct, setLocalProduct] = useState(product);

  const currentDesc = localProduct.memberPacketDescription || "";
  const cascadedDesc = resolveDescription({
    providerDescription: localProduct.providerDescription || null,
    adminCatalogDescription: localProduct.adminCatalogDescription || null,
    memberPacketDescription: localProduct.memberPacketDescription || null,
  });

  const colorList = localProduct.availableColors || [];
  const sizeList = localProduct.availableSizes || localProduct.sizes || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="overlay-member-product-detail"
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
          {localProduct.imageUrl ? (
            <img
              src={localProduct.imageUrl}
              alt={localProduct.title}
              className="max-h-[40vh] w-auto object-contain"
            />
          ) : (
            <Package className="w-16 h-16 text-slate-400" />
          )}
        </div>

        <div className="p-4 space-y-3">
          <h3 className="text-lg font-bold text-white">{localProduct.title}</h3>

          <div className="flex flex-wrap gap-2 items-center">
            {localProduct.retailPrice != null && (
              <span className="text-2xl font-bold text-emerald-400">${localProduct.retailPrice.toFixed(2)}</span>
            )}
            {localProduct.memberEarnings != null && (
              <Badge variant="secondary" className="bg-green-500/15 text-green-400 border-green-500/30">
                <DollarSign className="w-3 h-3 mr-1" />
                Earn ${localProduct.memberEarnings.toFixed(2)}
              </Badge>
            )}
          </div>

          {localProduct.brand && (
            <p className="text-xs text-slate-400">{localProduct.brand}</p>
          )}

          <div className="space-y-2">
            {editing ? (
              <>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="text-sm min-h-[80px] bg-slate-800 border-slate-600 text-white"
                  placeholder="Customize the product description..."
                  data-testid="textarea-member-desc"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 text-white"
                    onClick={() => {
                      setLocalProduct({
                        ...localProduct,
                        memberPacketDescription: draft,
                      });
                      setEditing(false);
                    }}
                    data-testid="button-save-member-desc"
                  >
                    Done
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-slate-300 border-slate-600"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div
                className="group cursor-pointer rounded-lg border border-dashed border-slate-600 p-2"
                onClick={() => {
                  setDraft(cascadedDesc);
                  setEditing(true);
                }}
                data-testid="button-edit-member-desc"
              >
                <div className="flex items-start gap-2">
                  <Pencil className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                  {currentDesc || localProduct.description ? (
                    <p className="text-sm text-slate-300">{currentDesc || localProduct.description}</p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">Tap to add your product description...</p>
                  )}
                </div>
              </div>
            )}
          </div>

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

          {localProduct.placements && localProduct.placements.length > 0 && (
            <p className="text-xs text-slate-400">
              Print areas: {localProduct.placements.map((pl: any) => pl.title || pl.id).join(", ")}
            </p>
          )}

          <Button
            onClick={() => {
              onSelect(localProduct);
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
