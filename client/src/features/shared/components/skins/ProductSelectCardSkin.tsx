import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import UsaFlag from "@/components/UsaFlag";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Factory,
  Package,
  Palette,
  Ruler,
  X,
  Info,
  Eye,
} from "lucide-react";

export interface ProductSelectItem {
  id: string;
  name: string;
  price: number | null;
  cost: number | null;
  manufacturer: string | null;
  madeInUSA: boolean;
  primaryImageUrl: string | null;
  description: string | null;
  colorsAvailable: Array<{ name: string; hex?: string }>;
  sizesAvailable: string[];
  defaultColor: string | null;
}

export interface ProductSelectCardSkinProps {
  item: ProductSelectItem;
  isSelected: boolean;
  onSelect: (id: string, item: ProductSelectItem) => void;
}

function PreviewModal({
  item,
  open,
  onOpenChange,
  onSelect,
  defaultColorEntry,
}: {
  item: ProductSelectItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
  defaultColorEntry: { name: string; hex?: string } | null;
}) {
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
                <h3 className="font-semibold text-lg leading-tight" data-testid={`text-preview-name-${item.id}`}>
                  {item.name}
                </h3>

                <div className="flex items-center gap-2 flex-wrap">
                  {item.price != null && <span className="text-xl font-bold">${item.price.toFixed(2)}</span>}
                  {defaultColorEntry && (
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="text-muted-foreground">&middot;</span>
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

                {(item.manufacturer || item.cost != null) && (
                  <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                    {item.manufacturer && (
                      <span className="flex items-center gap-1.5">
                        <Factory className="w-4 h-4" />
                        <span>{item.manufacturer}</span>
                      </span>
                    )}
                    {item.cost != null && (
                      <span className="text-muted-foreground">
                        {item.manufacturer && <span className="mx-1">&middot;</span>}
                        Cost: ${item.cost.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}

                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
              </div>

              {(item.colorsAvailable.length > 0 || item.sizesAvailable.length > 0) && (
                <div className="space-y-3">
                  {item.colorsAvailable.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Palette className="w-3.5 h-3.5" />
                        <span>{item.colorsAvailable.length} colors</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.colorsAvailable.map((c, i) => (
                          <div
                            key={i}
                            className="w-5 h-5 rounded-full border border-border"
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

export function ProductSelectCardSkin({ item, isSelected, onSelect }: ProductSelectCardSkinProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
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
              <span className="text-base font-bold" data-testid={`text-price-${item.id}`}>
                ${item.price.toFixed(2)}
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
            {item.cost != null && (
              <>
                {(defaultColorEntry || item.manufacturer) && <span className="opacity-60">&middot;</span>}
                <span data-testid={`text-cost-${item.id}`}>
                  Cost: ${item.cost.toFixed(2)}
                </span>
              </>
            )}
          </div>

          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-desc-${item.id}`}>
              {item.description}
            </p>
          )}

          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            onClick={() => setDetailsOpen(!detailsOpen)}
            data-testid={`toggle-details-${item.id}`}
          >
            <Info className="w-3 h-3" />
            More info
            {detailsOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {detailsOpen && (
            <div className="space-y-2 pt-1 border-t" data-testid={`details-panel-${item.id}`}>
              {item.description && <p className="text-xs text-muted-foreground line-clamp-3">{item.description}</p>}

              {!item.description && item.colorsAvailable.length === 0 && item.sizesAvailable.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No additional details available for this product yet.</p>
              )}

              {item.colorsAvailable.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Palette className="w-3 h-3" /> Colors ({item.colorsAvailable.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {item.colorsAvailable.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1 text-[10px] bg-muted/50 rounded px-1 py-0.5"
                        data-testid={`detail-color-${item.id}-${i}`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-border flex-shrink-0"
                          style={{ backgroundColor: c.hex || "#888" }}
                        />
                        <span className="truncate max-w-[70px]">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.sizesAvailable.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> Sizes ({item.sizesAvailable.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {item.sizesAvailable.map((s, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px]"
                        data-testid={`detail-size-${item.id}-${i}`}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            variant={isSelected ? "secondary" : "default"}
            className="w-full min-h-11 text-sm"
            onClick={() => onSelect(item.id, item)}
            data-testid={`button-select-${item.id}`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Selected
              </>
            ) : (
              "Select Product"
            )}
          </Button>
        </CardContent>
      </Card>

      <PreviewModal
        item={item}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onSelect={() => onSelect(item.id, item)}
        defaultColorEntry={defaultColorEntry}
      />
    </>
  );
}
