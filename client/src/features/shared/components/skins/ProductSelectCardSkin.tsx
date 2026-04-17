import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import UsaFlag from "@/components/UsaFlag";
import {
  Check,
  Factory,
  Package,
  Palette,
  Ruler,
  X,
  Eye,
  Pencil,
  Save,
  Loader2,
  Trash2,
} from "lucide-react";

export interface ProductSelectItem {
  id: string;
  name: string;
  providerTitle?: string | null;
  adminCatalogTitle?: string | null;
  price: number | null;
  cost: number | null;
  manufacturer: string | null;
  madeInUSA: boolean;
  primaryImageUrl: string | null;
  description: string | null;
  providerDescription?: string | null;
  adminCatalogDescription?: string | null;
  providerDescriptionRaw?: string | null;
  colorsAvailable: Array<{ name: string; hex?: string }>;
  sizesAvailable: string[];
  defaultColor: string | null;
}

export type TierValue = "good" | "better" | "best" | null;

export interface ProductSelectCardSkinProps {
  item: ProductSelectItem;
  isSelected: boolean;
  onSelect: (id: string, item: ProductSelectItem) => void;
  tier?: TierValue;
  onTierChange?: (id: string, tier: TierValue) => void;
  showTierControls?: boolean;
  onDescriptionSave?: (id: string, description: string) => Promise<void>;
  descriptionSaving?: boolean;
  editableDescription?: boolean;
  onTitleSave?: (id: string, title: string) => Promise<void>;
  titleSaving?: boolean;
  editableTitle?: boolean;
  selectLabel?: React.ReactNode;
  selectedLabel?: React.ReactNode;
  disableWhenSelected?: boolean;
  onDelete?: (id: string) => Promise<void>;
  deleting?: boolean;
}

function PreviewModal({
  item,
  open,
  onOpenChange,
  onSelect,
  defaultColorEntry,
  onDescriptionSave,
  descriptionSaving,
  editableDescription,
  onTitleSave,
  titleSaving,
  editableTitle,
}: {
  item: ProductSelectItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
  defaultColorEntry: { name: string; hex?: string } | null;
  onDescriptionSave?: (id: string, description: string) => Promise<void>;
  descriptionSaving?: boolean;
  editableDescription?: boolean;
  onTitleSave?: (id: string, title: string) => Promise<void>;
  titleSaving?: boolean;
  editableTitle?: boolean;
}) {
  const isMobile = useIsMobile();
  const [editingDesc, setEditingDesc] = useState(false);
  const [draftDesc, setDraftDesc] = useState(item.description || "");
  const [confirmResetDesc, setConfirmResetDesc] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.name || "");
  const [confirmResetTitle, setConfirmResetTitle] = useState(false);

  const handleSaveDesc = async () => {
    if (!onDescriptionSave) return;
    await onDescriptionSave(item.id, draftDesc);
    setEditingDesc(false);
  };

  const handleSaveTitle = async () => {
    if (!onTitleSave) return;
    await onTitleSave(item.id, draftTitle);
    setEditingTitle(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg w-[95vw] max-h-[90vh] p-0 overflow-hidden"
        data-testid={`modal-preview-${item.id}`}
      >
        <VisuallyHidden>
          <DialogTitle>{item.name}</DialogTitle>
        </VisuallyHidden>

        <ScrollArea className="max-h-[90vh]">
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10 bg-black/40 text-white"
              onClick={() => onOpenChange(false)}
              data-testid={`button-close-preview-${item.id}`}
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="relative aspect-square bg-muted flex items-center justify-center p-3">
              {item.primaryImageUrl ? (
                <img
                  src={item.primaryImageUrl}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain"
                  data-testid={`img-preview-large-${item.id}`}
                />
              ) : (
                <Package className="h-24 w-24 text-muted-foreground" />
              )}

              {item.madeInUSA && (
                <div className="absolute top-3 left-3">
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-background/90 backdrop-blur-sm text-xs shadow-sm"
                  >
                    <UsaFlag className="w-3 h-2" /> USA
                  </Badge>
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-2">
                {editableTitle && onTitleSave ? (
                  <div data-testid={`title-edit-area-${item.id}`}>
                    {editingTitle ? (
                      <div className="space-y-2">
                        <Input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          className="text-base font-semibold"
                          placeholder="Enter a custom title..."
                          data-testid={`input-title-${item.id}`}
                        />
                        {item.providerTitle && item.providerTitle !== draftTitle && (
                          confirmResetTitle ? (
                            <div className="flex items-center gap-2 text-xs" data-testid={`confirm-reset-title-${item.id}`}>
                              <span className="text-muted-foreground">Reset to original — are you sure?</span>
                              <button
                                type="button"
                                className="text-red-400 hover:text-red-300 underline font-medium"
                                onClick={() => { setDraftTitle(item.providerTitle || ""); setConfirmResetTitle(false); }}
                                data-testid={`button-confirm-yes-reset-title-${item.id}`}
                              >
                                Yes, reset
                              </button>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground underline"
                                onClick={() => setConfirmResetTitle(false)}
                                data-testid={`button-confirm-cancel-reset-title-${item.id}`}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-blue-400 hover:text-blue-300 underline"
                              onClick={() => setConfirmResetTitle(true)}
                              data-testid={`button-reset-to-provider-title-${item.id}`}
                            >
                              Reset to original title
                            </button>
                          )
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveTitle} disabled={titleSaving} data-testid={`button-save-title-${item.id}`}>
                            {titleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingTitle(false); setDraftTitle(item.name || ""); }} data-testid={`button-cancel-title-${item.id}`}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="group cursor-pointer rounded-md border border-dashed border-muted-foreground/30 p-2"
                        onClick={() => { setDraftTitle(item.name || ""); setEditingTitle(true); }}
                        data-testid={`button-edit-title-${item.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <Pencil className="w-3.5 h-3.5 mt-1 text-muted-foreground shrink-0" />
                          <h3 className="font-semibold text-lg leading-tight" data-testid={`text-preview-name-${item.id}`}>
                            {item.name}
                          </h3>
                        </div>
                        {item.adminCatalogTitle && (
                          <span className="ml-6 text-xs text-blue-400">Custom title</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <h3 className="font-semibold text-lg leading-tight" data-testid={`text-preview-name-${item.id}`}>
                    {item.name}
                  </h3>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  {item.price != null && (
                    <span className="text-2xl font-bold" data-testid={`text-preview-price-${item.id}`}>
                      ${item.price.toFixed(2)}
                    </span>
                  )}
                  {item.cost != null && (
                    <span className="text-sm text-muted-foreground">
                      Cost: ${item.cost.toFixed(2)}
                    </span>
                  )}
                  {item.price != null && item.cost != null && (
                    <Badge variant="secondary" className="bg-green-500/15 text-green-600 text-sm">
                      +${(item.price - item.cost).toFixed(2)} profit
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {defaultColorEntry && (
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: defaultColorEntry.hex || "#888" }}
                        />
                        <span>{defaultColorEntry.name}</span>
                      </span>
                    </span>
                  )}
                </div>

                {item.manufacturer && (
                  <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Factory className="w-4 h-4" />
                      <span>{item.manufacturer}</span>
                    </span>
                  </div>
                )}

                {editableDescription && onDescriptionSave ? (
                  <div className="space-y-2" data-testid={`desc-edit-area-${item.id}`}>
                    {editingDesc ? (
                      <>
                        <Textarea
                          value={draftDesc}
                          onChange={(e) => setDraftDesc(e.target.value)}
                          className="text-sm min-h-[80px]"
                          placeholder="Enter a custom description for this product..."
                          data-testid={`textarea-desc-${item.id}`}
                        />
                        {(item.providerDescription || item.providerDescriptionRaw) && (item.providerDescription || item.providerDescriptionRaw) !== draftDesc && (
                          confirmResetDesc ? (
                            <div className="flex items-center gap-2 text-xs" data-testid={`confirm-reset-desc-${item.id}`}>
                              <span className="text-muted-foreground">Reset to original — are you sure?</span>
                              <button
                                type="button"
                                className="text-red-400 hover:text-red-300 underline font-medium"
                                onClick={() => { setDraftDesc(item.providerDescription || item.providerDescriptionRaw || ""); setConfirmResetDesc(false); }}
                                data-testid={`button-confirm-yes-reset-desc-${item.id}`}
                              >
                                Yes, reset
                              </button>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground underline"
                                onClick={() => setConfirmResetDesc(false)}
                                data-testid={`button-confirm-cancel-reset-desc-${item.id}`}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-blue-400 hover:text-blue-300 underline"
                              onClick={() => setConfirmResetDesc(true)}
                              data-testid={`button-reset-to-provider-${item.id}`}
                            >
                              Reset to original description
                            </button>
                          )
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveDesc}
                            disabled={descriptionSaving}
                            data-testid={`button-save-desc-${item.id}`}
                          >
                            {descriptionSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingDesc(false); setDraftDesc(item.description || ""); }}
                            data-testid={`button-cancel-desc-${item.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div
                        className="group cursor-pointer rounded-md border border-dashed border-muted-foreground/30 p-2"
                        onClick={() => { setDraftDesc(item.description || item.providerDescription || ""); setEditingDesc(true); }}
                        data-testid={`button-edit-desc-${item.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <Pencil className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          {item.description ? (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Tap to add a custom description...</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  item.description && <p className="text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>

              {(item.colorsAvailable.length > 0 || item.sizesAvailable.length > 0) && (
                <div className="space-y-3">
                  {item.colorsAvailable.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Palette className="w-3.5 h-3.5" />
                        <span>{item.colorsAvailable.length} colors</span>
                      </div>
                      <div className={`flex flex-wrap gap-1.5 ${isMobile ? "max-h-[52px] overflow-hidden" : ""}`}>
                        {item.colorsAvailable.map((c, i) => (
                          <div
                            key={i}
                            className="w-5 h-5 rounded-full border border-border flex-shrink-0"
                            style={{ backgroundColor: c.hex || "#888" }}
                            title={c.name}
                            data-testid={`preview-swatch-${item.id}-${i}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {item.sizesAvailable.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Ruler className="w-3.5 h-3.5" />
                        <span>{item.sizesAvailable.length} sizes</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.sizesAvailable.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full min-h-12 text-base"
                onClick={() => {
                  onSelect();
                  onOpenChange(false);
                }}
                data-testid={`button-modal-select-${item.id}`}
              >
                Select This Product
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const TIER_COLORS: Record<string, string> = {
  good: "bg-blue-600 text-white",
  better: "bg-amber-500 text-white",
  best: "bg-emerald-600 text-white",
};

const TIER_LABELS: Record<string, string> = {
  good: "Good",
  better: "Better",
  best: "Best",
};

export function ProductSelectCardSkin({ item, isSelected, onSelect, tier, onTierChange, showTierControls, onDescriptionSave, descriptionSaving, editableDescription, onTitleSave, titleSaving, editableTitle, selectLabel, selectedLabel, disableWhenSelected, onDelete, deleting }: ProductSelectCardSkinProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const defaultColorEntry = useMemo(() => {
    if (item.defaultColor) {
      return (
        item.colorsAvailable.find(
          (c) => c.name.toLowerCase() === item.defaultColor!.toLowerCase()
        ) || null
      );
    }
    return item.colorsAvailable[0] || null;
  }, [item.colorsAvailable, item.defaultColor]);

  return (
    <>
      <Card
        className={`overflow-hidden transition-all ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
        data-testid={`select-card-${item.id}`}
      >
        <div
          className="relative w-full aspect-square max-h-[180px] flex items-center justify-center rounded-t-xl bg-muted cursor-pointer overflow-hidden"
          onClick={() => setPreviewOpen(true)}
          data-testid={`img-tap-${item.id}`}
        >
          {isSelected && (
            <div
              className="absolute top-0 left-0 right-0 z-10 bg-primary text-primary-foreground text-[11px] font-semibold text-center py-1"
              data-testid={`banner-selected-${item.id}`}
            >
              SELECTED
            </div>
          )}

          {item.primaryImageUrl ? (
            <img
              src={item.primaryImageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain p-3"
              data-testid={`img-product-${item.id}`}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Package className="h-12 w-12" />
            </div>
          )}

          {item.madeInUSA && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="gap-1 bg-background/90 backdrop-blur-sm text-xs shadow-sm">
                <UsaFlag className="w-3 h-2" />
                USA
              </Badge>
            </div>
          )}

          {tier && (
            <div className="absolute top-2 left-2">
              <Badge className={`text-xs shadow-sm ${TIER_COLORS[tier]}`} data-testid={`badge-tier-${item.id}`}>
                {TIER_LABELS[tier]}
              </Badge>
            </div>
          )}

          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-background/80 backdrop-blur-sm px-2 py-1 text-[11px] text-muted-foreground">
            <Eye className="w-3.5 h-3.5" />
            Tap to preview
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-base leading-snug line-clamp-2" data-testid={`text-name-${item.id}`}>
            {item.name}
          </h3>

          <div className="flex items-baseline gap-2 flex-wrap">
            {item.price != null && (
              <span className="text-lg font-bold" data-testid={`text-price-${item.id}`}>
                ${item.price.toFixed(2)}
              </span>
            )}
            {item.cost != null && (
              <span className="text-sm text-muted-foreground" data-testid={`text-cost-card-${item.id}`}>
                Cost: ${item.cost.toFixed(2)}
              </span>
            )}
            {item.price != null && item.cost != null && (
              <span className="text-sm font-semibold text-green-600" data-testid={`text-profit-${item.id}`}>
                +${(item.price - item.cost).toFixed(2)} profit
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
            {defaultColorEntry && (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border border-border flex-shrink-0"
                  style={{ backgroundColor: defaultColorEntry.hex || "#888" }}
                />
                <span className="truncate max-w-[140px]">{defaultColorEntry.name}</span>
              </span>
            )}
            {item.manufacturer && (
              <span className="flex items-center gap-1.5">
                {defaultColorEntry && <span className="opacity-60">&middot;</span>}
                <Factory className="w-3.5 h-3.5" />
                <span className="truncate max-w-[160px]">{item.manufacturer}</span>
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-desc-${item.id}`}>
            {item.description || "No description set."}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant={isSelected ? "secondary" : "default"}
              className="flex-1 min-h-11 text-sm"
              onClick={() => onSelect(item.id, item)}
              disabled={isSelected && !!disableWhenSelected}
              data-testid={`button-select-${item.id}`}
            >
              {isSelected ? (
                selectedLabel ?? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Selected
                  </>
                )
              ) : (
                selectLabel ?? "Select Product"
              )}
            </Button>
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(item.id)}
                disabled={deleting}
                data-testid={`button-delete-${item.id}`}
                title="Remove from catalog"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>

          {showTierControls && isSelected && onTierChange && (
            <div className="flex gap-1.5" data-testid={`tier-controls-${item.id}`}>
              {(["good", "better", "best"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tier === t ? "default" : "outline"}
                  className={`flex-1 text-xs ${tier === t ? TIER_COLORS[t] : ""}`}
                  onClick={() => onTierChange(item.id, tier === t ? null : t)}
                  data-testid={`button-tier-${t}-${item.id}`}
                >
                  {TIER_LABELS[t]}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PreviewModal
        item={item}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onSelect={() => onSelect(item.id, item)}
        defaultColorEntry={defaultColorEntry}
        onDescriptionSave={onDescriptionSave}
        descriptionSaving={descriptionSaving}
        editableDescription={editableDescription}
        onTitleSave={onTitleSave}
        titleSaving={titleSaving}
        editableTitle={editableTitle}
      />
    </>
  );
}
