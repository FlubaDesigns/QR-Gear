import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Package, Palette, Ruler, Save, Loader2, X } from "lucide-react";
export interface AdminBlankDetailItem {
  id: string;
  title: string;
  imageUrl: string | null;
  brand?: string;
  retailPrice?: number;
  baseCost?: number;
  providerDescription: string | null;
  adminCatalogDescription: string | null;
  effectiveDescription: string | null;
  availableColors: Array<{ name: string; hex?: string }>;
  availableSizes: string[];
  fulfillmentProvider?: string;
  tier?: string;
}

export interface AdminBlankDetailSkinProps {
  item: AdminBlankDetailItem;
  onSaveDescription?: (id: string, description: string) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

export function AdminBlankDetailSkin({ item, onSaveDescription, onClose, saving }: AdminBlankDetailSkinProps) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(item.adminCatalogDescription || "");
  // Local mirror so the UI reflects the saved value immediately without waiting for the parent query to refetch
  const [localAdminDesc, setLocalAdminDesc] = useState<string | null>(item.adminCatalogDescription);

  // Sync when the parent query refetches while the modal is still open
  useEffect(() => {
    if (!editingDesc) {
      setLocalAdminDesc(item.adminCatalogDescription);
    }
  }, [item.adminCatalogDescription]);

  const effectiveDescription = (localAdminDesc && localAdminDesc.trim())
    ? localAdminDesc
    : (item.providerDescription || item.effectiveDescription);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="overlay-admin-blank-detail"
    >
      <div
        className="relative w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl animate-in zoom-in-90 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-black/50 rounded-full p-1.5"
          data-testid="button-close-admin-blank-detail"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="bg-white rounded-t-2xl p-4 flex items-center justify-center min-h-[200px]">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} className="max-h-[35vh] w-auto object-contain" />
          ) : (
            <Package className="w-16 h-16 text-slate-400" />
          )}
        </div>

        <div className="p-4 space-y-3">
          <h3 className="text-lg font-bold text-white">{item.title}</h3>

          <div className="flex flex-wrap gap-2 items-center">
            {item.retailPrice != null && (
              <span className="text-xl font-bold text-emerald-400">${item.retailPrice.toFixed(2)}</span>
            )}
            {item.baseCost != null && (
              <span className="text-sm text-slate-400">Cost: ${item.baseCost.toFixed(2)}</span>
            )}
            {item.tier && (
              <Badge variant="secondary" className="text-xs">{item.tier}</Badge>
            )}
            {item.fulfillmentProvider && (
              <Badge variant="outline" className="text-xs text-slate-300 border-slate-600">
                {item.fulfillmentProvider}
              </Badge>
            )}
          </div>

          {item.brand && <p className="text-xs text-slate-400">{item.brand}</p>}

          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Provider Description</p>
            <p className="text-sm text-slate-400">{item.providerDescription || "None"}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Admin Catalog Description</p>
              {onSaveDescription && !editingDesc && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 text-xs"
                  onClick={() => {
                    setDescDraft(localAdminDesc || "");
                    setEditingDesc(true);
                  }}
                  data-testid="button-edit-admin-desc"
                >
                  Edit
                </Button>
              )}
            </div>
            {editingDesc ? (
              <>
                <Textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  className="text-sm min-h-[80px] bg-slate-800 border-slate-600 text-white"
                  placeholder="Set the admin catalog description..."
                  data-testid="textarea-admin-desc"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 text-white"
                    disabled={saving}
                    onClick={async () => {
                      if (onSaveDescription) {
                        await onSaveDescription(item.id, descDraft);
                        setLocalAdminDesc(descDraft);
                      }
                      setEditingDesc(false);
                    }}
                    data-testid="button-save-admin-desc"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="text-slate-300 border-slate-600" onClick={() => setEditingDesc(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-300">{localAdminDesc || "Not set — using provider description"}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Effective Public Description</p>
            <p className="text-sm text-slate-300 italic">{effectiveDescription || "None"}</p>
          </div>

          {item.availableColors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Palette className="w-3 h-3" />
                {item.availableColors.length} colors
              </p>
              <div className="flex flex-wrap gap-1.5">
                {item.availableColors.map((c, i) => (
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

          {item.availableSizes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Ruler className="w-3 h-3" />
                Sizes
              </p>
              <div className="flex flex-wrap gap-1">
                {item.availableSizes.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs text-slate-300 border-slate-600">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
