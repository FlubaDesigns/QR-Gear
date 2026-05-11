import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, DollarSign, Package, Palette, Ruler, Pencil, X, Loader2 } from "lucide-react";
import type { AllowedProduct } from "@/features/shared/components/wizardSteps/wizardTypes";

export interface MemberProductDetailSkinProps {
  product: AllowedProduct;
  onSelect: (product: AllowedProduct) => void;
  onClose: () => void;
  onDescriptionSave?: (product: AllowedProduct, description: string) => Promise<void>;
}

export function MemberProductDetailSkin({ product, onSelect, onClose, onDescriptionSave }: MemberProductDetailSkinProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [localProduct, setLocalProduct] = useState(product);

  const cascadedDesc = localProduct.memberPacketDescription
    || localProduct.effectiveDescription
    || localProduct.adminCatalogDescription
    || localProduct.providerDescription
    || "";

  const colorList = localProduct.availableColors || [];
  const sizeList = localProduct.availableSizes || [];

  const handleSave = async () => {
    const updated = {
      ...localProduct,
      memberPacketDescription: draft,
      effectiveDescription: draft || localProduct.adminCatalogDescription || localProduct.providerDescription || "",
    };
    setLocalProduct(updated);
    setEditing(false);

    if (onDescriptionSave) {
      setSaving(true);
      try {
        await onDescriptionSave(updated, draft);
      } catch {
      } finally {
        setSaving(false);
      }
    }
  };

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
                    disabled={saving}
                    onClick={handleSave}
                    data-testid="button-save-member-desc"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-slate-300 border-slate-600"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  {(localProduct.providerDescription || localProduct.adminCatalogDescription) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 text-xs ml-auto"
                      onClick={() => setDraft(localProduct.adminCatalogDescription || localProduct.providerDescription || "")}
                      data-testid="button-reset-to-default-desc"
                    >
                      Reset to default
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                {cascadedDesc ? (
                  <p className="text-sm text-slate-300" data-testid="text-member-product-desc">{cascadedDesc}</p>
                ) : (
                  <p className="text-sm text-slate-500 italic" data-testid="text-member-product-desc-empty">No description yet.</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-slate-300 border-slate-600"
                  onClick={() => {
                    setDraft(cascadedDesc);
                    setEditing(true);
                  }}
                  data-testid="button-edit-member-desc"
                >
                  <Pencil className="w-3 h-3 mr-1.5" />
                  Edit Description
                </Button>
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
