import { useMemo, useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import UsaFlag from "@/components/UsaFlag";
import {
  Check,
  Factory,
  Package,
  Palette,
  Ruler,
  Eye,
  Pencil,
  Save,
  Loader2,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Images,
  X,
  CheckSquare,
  Square,
} from "lucide-react";

export interface ProductSelectItem {
  id: string;
  name: string;
  providerTitle?: string | null;
  adminCatalogTitle?: string | null;
  price: number | null;
  cost: number | null;
  manufacturer: string | null;
  model?: string | null;
  madeInUSA: boolean;
  primaryImageUrl: string | null;
  images?: string[];
  description: string | null;
  providerDescription?: string | null;
  adminCatalogDescription?: string | null;
  providerDescriptionRaw?: string | null;
  colorsAvailable: Array<{ name: string; hex?: string }>;
  sizesAvailable: string[];
  defaultColor: string | null;
  qrgBlankId?: number | null;
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
  selectDisabled?: boolean;
  selectDisabledTitle?: string;
  onDelete?: (id: string) => Promise<void>;
  deleting?: boolean;
  onImageDelete?: (id: string, imageUrl: string) => Promise<void>;
  onImageRestore?: (id: string) => Promise<void>;
  onImagesBulkSave?: (id: string, images: string[]) => Promise<void>;
  masterCatalogImages?: string[];
  fulfillmentProvider?: string;
  mockupImageUrl?: string | null;
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
  onImageDelete,
  onImageRestore,
  onImagesBulkSave,
  masterCatalogImages,
  tier,
  onTierChange,
  showTierControls,
  mockupImageUrl,
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
  mockupImageUrl?: string | null;
  onImageDelete?: (id: string, imageUrl: string) => Promise<void>;
  onImageRestore?: (id: string) => Promise<void>;
  onImagesBulkSave?: (id: string, images: string[]) => Promise<void>;
  masterCatalogImages?: string[];
  tier?: TierValue;
  onTierChange?: (id: string, tier: TierValue) => void;
  showTierControls?: boolean;
}) {
  const isMobile = useIsMobile();
  const [editingDesc, setEditingDesc] = useState(false);
  const [draftDesc, setDraftDesc] = useState(item.description || "");
  const [confirmResetDesc, setConfirmResetDesc] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(item.name || "");
  const [confirmResetTitle, setConfirmResetTitle] = useState(false);

  const masterImages = useMemo(() => {
    const imgs = item.images?.length ? item.images : (item.primaryImageUrl ? [item.primaryImageUrl] : []);
    return imgs;
  }, [item.images, item.primaryImageUrl]);

  const [localImages, setLocalImages] = useState<string[]>(masterImages);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Prepend the mockup as the very first image when available.
  // localImages always stays as the editable product images only — mockup is display-only.
  const displayImages = useMemo(
    () => (mockupImageUrl ? [mockupImageUrl, ...localImages] : localImages),
    [mockupImageUrl, localImages]
  );
  const isMockupIndex = mockupImageUrl ? currentIndex === 0 : false;
  const currentImage = displayImages[currentIndex] ?? null;
  const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setLocalImages(masterImages);
    setCurrentIndex(0);
  }, [item.id, masterImages.join(",")]);

  const handlePrev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex(i => Math.min(displayImages.length - 1, i + 1));

  const handleDeleteImage = async (imgUrl: string) => {
    if (!onImageDelete || deletingImageUrl) return;
    setDeletingImageUrl(imgUrl);
    const newImages = localImages.filter(u => u !== imgUrl);
    setLocalImages(newImages);
    if (currentIndex >= newImages.length && newImages.length > 0) {
      setCurrentIndex(newImages.length - 1);
    }
    try {
      await onImageDelete(item.id, imgUrl);
    } catch {
      setLocalImages(localImages);
    } finally {
      setDeletingImageUrl(null);
    }
  };

  const handleSaveDesc = async () => {
    if (!onDescriptionSave) return;
    if (editingTitle && onTitleSave) {
      await onTitleSave(item.id, draftTitle);
      setEditingTitle(false);
    }
    await onDescriptionSave(item.id, draftDesc);
    setEditingDesc(false);
  };

  const handleSaveTitle = async () => {
    if (!onTitleSave) return;
    await onTitleSave(item.id, draftTitle);
    setEditingTitle(false);
  };

  const [restoringImages, setRestoringImages] = useState(false);
  const imagesAreModified = masterCatalogImages !== undefined
    && localImages.join(",") !== masterCatalogImages.join(",");

  const handleRestoreImages = async () => {
    if (!onImageRestore || restoringImages) return;
    setRestoringImages(true);
    try {
      await onImageRestore(item.id);
      if (masterCatalogImages) {
        setLocalImages(masterCatalogImages);
        setCurrentIndex(0);
      }
    } finally {
      setRestoringImages(false);
    }
  };

  // ── Bulk select mode ──────────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const enterBulkMode = useCallback(() => {
    setSelectedForDeletion(new Set());
    setBulkMode(true);
  }, []);

  const exitBulkMode = useCallback(() => {
    setBulkMode(false);
    setSelectedForDeletion(new Set());
  }, []);

  const toggleBulkImage = useCallback((url: string) => {
    setSelectedForDeletion(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }, []);

  const selectAllForDeletion = useCallback(() => {
    setSelectedForDeletion(new Set(localImages));
  }, [localImages]);

  const clearBulkSelection = useCallback(() => {
    setSelectedForDeletion(new Set());
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    if (!onImagesBulkSave || bulkSaving || selectedForDeletion.size === 0) return;
    const keptImages = localImages.filter(img => !selectedForDeletion.has(img));
    setBulkSaving(true);
    try {
      await onImagesBulkSave(item.id, keptImages);
      setLocalImages(keptImages);
      setCurrentIndex(0);
      exitBulkMode();
    } finally {
      setBulkSaving(false);
    }
  }, [onImagesBulkSave, bulkSaving, selectedForDeletion, localImages, item.id, exitBulkMode]);

  // Enter = confirm bulk delete, Escape = exit bulk mode
  useEffect(() => {
    if (!bulkMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedForDeletion.size > 0) confirmBulkDelete();
      else if (e.key === 'Escape') exitBulkMode();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bulkMode, selectedForDeletion.size, confirmBulkDelete, exitBulkMode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg w-[95vw] max-h-[90vh] p-0 overflow-hidden"
        data-testid={`modal-preview-${item.id}`}
      >
        <VisuallyHidden>
          <DialogTitle>{item.name}</DialogTitle>
        </VisuallyHidden>

        <div className="max-h-[90vh] overflow-y-auto">
          <div className="relative">
            {/* Main image gallery */}
            <div
              className={`relative bg-muted flex items-center justify-center overflow-hidden ${
                isMobile ? "min-h-[220px] max-h-[45vh]" : "aspect-square"
              }`}
            >
              {currentImage ? (
                <img
                  key={currentImage}
                  src={currentImage}
                  alt={`${item.name} ${currentIndex + 1} of ${displayImages.length}`}
                  loading="lazy"
                  decoding="async"
                  className={`max-w-full max-h-full object-contain ${isMobile ? "p-2" : "p-3"}`}
                  data-testid={`img-preview-large-${item.id}`}
                />
              ) : (
                <Package className="h-24 w-24 text-muted-foreground" />
              )}

              {/* Mockup label — shown when viewing the generated mockup image */}
              {isMockupIndex && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary/90 text-primary-foreground text-xs backdrop-blur-sm shadow-sm">
                    Mockup
                  </Badge>
                </div>
              )}

              {/* Prev / Next navigation — desktop only, overlaid on image */}
              {!isMobile && displayImages.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 text-white disabled:opacity-30"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    data-testid={`button-img-prev-${item.id}`}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 text-white disabled:opacity-30"
                    onClick={handleNext}
                    disabled={currentIndex === displayImages.length - 1}
                    data-testid={`button-img-next-${item.id}`}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}

              {/* Counter — desktop only inside image */}
              {!isMobile && displayImages.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
                  {currentIndex + 1} / {displayImages.length}
                </div>
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

            {/* Mobile prev/next row — below the image, easy one-thumb reach */}
            {isMobile && displayImages.length > 1 && (
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  data-testid={`button-img-prev-${item.id}`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} / {displayImages.length}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleNext}
                  disabled={currentIndex === displayImages.length - 1}
                  data-testid={`button-img-next-${item.id}`}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Image action row — delete + restore, always below the image for easy access */}
            {(onImageDelete || onImageRestore) && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/20 border-b">
                <div className="flex-1">
                  {onImageRestore && imagesAreModified && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground"
                      onClick={handleRestoreImages}
                      disabled={restoringImages}
                      data-testid={`button-restore-images-${item.id}`}
                    >
                      {restoringImages
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RotateCcw className="h-4 w-4" />
                      }
                      Restore all
                    </Button>
                  )}
                </div>
                {/* Delete is disabled on the mockup — it's not a catalog image */}
                {onImageDelete && currentImage && !isMockupIndex && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive/80"
                    onClick={() => handleDeleteImage(currentImage)}
                    disabled={!!deletingImageUrl}
                    data-testid={`button-delete-img-${item.id}`}
                  >
                    {deletingImageUrl === currentImage
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                    Remove this image
                  </Button>
                )}
              </div>
            )}

            {/* Thumbnail strip — horizontal scrollable rail */}
            {displayImages.length > 1 && (
              <div className="bg-muted/50 px-3 py-2 border-t" data-testid={`gallery-strip-${item.id}`}>
                <div className="flex gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap touch-pan-x snap-x snap-mandatory pb-1">
                  {displayImages.map((imgUrl, idx) => {
                    const isMockupThumb = mockupImageUrl ? idx === 0 : false;
                    return (
                      <button
                        key={imgUrl}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`relative snap-start flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                          idx === currentIndex ? "border-primary" : "border-transparent"
                        }`}
                        data-testid={`button-thumb-${item.id}-${idx}`}
                      >
                        <img
                          src={imgUrl}
                          alt={isMockupThumb ? "Mockup" : `Thumbnail ${idx}`}
                          className="w-full h-full object-contain bg-background p-0.5"
                        />
                        {isMockupThumb && (
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-semibold bg-primary/80 text-primary-foreground leading-tight py-0.5">
                            Mockup
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Image count indicator + bulk select entry point */}
            {onImageDelete && (
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/30 text-xs text-muted-foreground border-t">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Images className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {localImages.length > 0
                      ? `${localImages.length} image${localImages.length !== 1 ? "s" : ""} forwarded to members`
                      : "No images — use Restore all to reset"
                    }
                  </span>
                </div>
                {onImagesBulkSave && localImages.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2 flex-shrink-0"
                    onClick={enterBulkMode}
                    data-testid={`button-bulk-select-${item.id}`}
                  >
                    <CheckSquare className="w-3 h-3 mr-1" />
                    Select
                  </Button>
                )}
              </div>
            )}

            {/* ── Bulk select grid ── */}
            {bulkMode && (
              <div className="border-t bg-background" data-testid={`bulk-select-panel-${item.id}`}>
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={selectedForDeletion.size === localImages.length ? clearBulkSelection : selectAllForDeletion}
                      data-testid={`button-select-all-${item.id}`}
                    >
                      {selectedForDeletion.size === localImages.length
                        ? <><Square className="w-3.5 h-3.5" /> Deselect all</>
                        : <><CheckSquare className="w-3.5 h-3.5" /> Select all</>
                      }
                    </Button>
                    {selectedForDeletion.size > 0 && (
                      <span className="text-xs text-destructive font-medium">
                        {selectedForDeletion.size} will be removed
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={exitBulkMode}
                    data-testid={`button-bulk-cancel-${item.id}`}
                  >
                    Cancel
                  </Button>
                </div>

                {/* Image grid */}
                <div className="grid grid-cols-3 gap-1.5 p-2 max-h-[40vh] overflow-y-auto">
                  {localImages.map((imgUrl, idx) => {
                    const marked = selectedForDeletion.has(imgUrl);
                    return (
                      <button
                        key={imgUrl}
                        type="button"
                        onClick={() => toggleBulkImage(imgUrl)}
                        className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                          marked ? "border-destructive" : "border-transparent"
                        }`}
                        data-testid={`bulk-img-${item.id}-${idx}`}
                      >
                        <img
                          src={imgUrl}
                          alt={`Image ${idx + 1}`}
                          className="w-full h-full object-contain bg-muted p-0.5"
                        />
                        {/* Overlay for selected (to-be-deleted) images */}
                        {marked && (
                          <div className="absolute inset-0 bg-destructive/30 flex items-center justify-center">
                            <div className="bg-destructive rounded-full p-0.5">
                              <X className="w-3.5 h-3.5 text-destructive-foreground" />
                            </div>
                          </div>
                        )}
                        {/* Keep indicator for unselected */}
                        {!marked && (
                          <div className="absolute top-1 right-1">
                            <div className="bg-background/80 rounded-full p-0.5">
                              <Check className="w-3 h-3 text-green-500" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Confirm delete footer */}
                <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/20">
                  <p className="text-xs text-muted-foreground flex-1">
                    {selectedForDeletion.size === 0
                      ? "Select images above to remove them"
                      : `${localImages.length - selectedForDeletion.size} image${localImages.length - selectedForDeletion.size !== 1 ? "s" : ""} will be kept`
                    }
                  </p>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={confirmBulkDelete}
                    disabled={selectedForDeletion.size === 0 || bulkSaving}
                    data-testid={`button-bulk-confirm-${item.id}`}
                  >
                    {bulkSaving
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                    Delete {selectedForDeletion.size > 0 ? selectedForDeletion.size : ""} selected
                  </Button>
                </div>
              </div>
            )}

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
                        <p className="text-xs text-muted-foreground">Title will save with description below.</p>
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

                {(item.manufacturer || item.model) && (
                  <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Factory className="w-4 h-4" />
                      <span>{[item.manufacturer, item.model].filter(Boolean).join(' ')}</span>
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

              {showTierControls && onTierChange && (
                <div className="space-y-1.5" data-testid={`tier-controls-modal-${item.id}`}>
                  <p className="text-xs text-muted-foreground font-medium">Quality Tier</p>
                  <div className="flex gap-2">
                    {(["good", "better", "best"] as const).map((t) => (
                      <Button
                        key={t}
                        size="sm"
                        variant={tier === t ? "default" : "outline"}
                        className={`flex-1 text-xs ${tier === t ? TIER_COLORS[t] : ""}`}
                        onClick={() => onTierChange(item.id, tier === t ? null : t)}
                        data-testid={`button-modal-tier-${t}-${item.id}`}
                      >
                        {TIER_LABELS[t]}
                      </Button>
                    ))}
                  </div>
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
        </div>
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

export function ProductSelectCardSkin({ item, isSelected, onSelect, tier, onTierChange, showTierControls, onDescriptionSave, descriptionSaving, editableDescription, onTitleSave, titleSaving, editableTitle, selectLabel, selectedLabel, disableWhenSelected, selectDisabled, selectDisabledTitle, onDelete, deleting, onImageDelete, onImageRestore, onImagesBulkSave, masterCatalogImages, fulfillmentProvider, mockupImageUrl }: ProductSelectCardSkinProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

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
            {item.images && item.images.length > 1 ? `${item.images.length} photos` : "Tap to preview"}
          </div>

          {fulfillmentProvider && (
            <div className="absolute bottom-2 right-2">
              <Badge
                variant="outline"
                className="text-[10px] bg-background/90 backdrop-blur-sm shadow-sm"
                data-testid={`badge-provider-${item.id}`}
              >
                {fulfillmentProvider === "printful" ? "Printful" : fulfillmentProvider === "printify" ? "Printify" : fulfillmentProvider}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-3 space-y-2">
          <h3
            className="font-semibold text-sm leading-snug line-clamp-2"
            data-testid={`text-name-${item.id}`}
          >
            {item.name}
          </h3>

          <p
            className="text-[10px] text-muted-foreground/60 font-mono"
            data-testid={`text-id-${item.id}`}
          >
            ID: {item.id}
          </p>

          {(item.manufacturer || item.model) && (
            <p className="text-xs text-muted-foreground truncate" data-testid={`text-make-model-${item.id}`}>
              {[item.manufacturer, item.model].filter(Boolean).join(' ')}
            </p>
          )}

          {item.qrgBlankId != null && (
            <p className="text-[10px] text-muted-foreground/60 font-mono" data-testid={`text-qrg-${item.id}`}>
              QRG-{item.qrgBlankId}
            </p>
          )}

          <div className="flex items-center justify-between gap-1 flex-wrap">
            {fulfillmentProvider && (
              <Badge
                variant="outline"
                className="text-[10px] bg-background/80"
                data-testid={`badge-provider-card-${item.id}`}
              >
                {fulfillmentProvider === "printful" ? "Printful" : fulfillmentProvider === "printify" ? "Printify" : fulfillmentProvider}
              </Badge>
            )}
            {item.price != null && (
              <span className="text-sm font-bold ml-auto" data-testid={`text-price-${item.id}`}>
                ${item.price.toFixed(2)}
              </span>
            )}
          </div>

          <Button
            variant={isSelected ? "secondary" : "default"}
            className="w-full min-h-11 text-sm"
            onClick={(e) => { e.stopPropagation(); onSelect(item.id, item); }}
            disabled={(isSelected && !!disableWhenSelected) || !!selectDisabled}
            title={selectDisabled ? selectDisabledTitle : undefined}
            data-testid={`button-select-${item.id}`}
          >
            {isSelected ? (
              selectedLabel ?? (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Added
                </>
              )
            ) : (
              selectLabel ?? "Add"
            )}
          </Button>

          {onDelete && !confirmDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive/70 text-xs"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              disabled={deleting}
              data-testid={`button-delete-${item.id}`}
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              Remove from catalog
            </Button>
          )}
          {onDelete && confirmDelete && (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 text-xs"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); onDelete(item.id); }}
                disabled={deleting}
                data-testid={`button-confirm-delete-${item.id}`}
              >
                Remove
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                data-testid={`button-cancel-delete-${item.id}`}
              >
                Keep
              </Button>
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
        onImageDelete={onImageDelete}
        onImageRestore={onImageRestore}
        onImagesBulkSave={onImagesBulkSave}
        masterCatalogImages={masterCatalogImages}
        tier={tier}
        onTierChange={onTierChange}
        showTierControls={showTierControls}
        mockupImageUrl={mockupImageUrl}
      />
    </>
  );
}
