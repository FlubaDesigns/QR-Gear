import { useState } from "react";
import { Package, Flag, ChevronDown, ChevronUp, Palette, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { CardSkinProps, DetailSkinProps } from "./types";

interface ColorEntry {
  name: string;
  hex?: string;
  color?: string;
}

function getColorHex(c: ColorEntry): string {
  return c.hex || c.color || "#888";
}

export function ProductCardSkin({ item, onClick }: CardSkinProps) {
  const imageUrl = item.primaryImage;
  const metadata = (item.metadata || {}) as Record<string, any>;
  const madeInUSA = metadata.originCountry === "US" || metadata.originCountry === "USA" || metadata.madeInUSA === true;
  const isEnabled = metadata.isEnabled !== false;

  const colors: ColorEntry[] = Array.isArray(metadata.availableColors) ? metadata.availableColors : [];
  const previewColors = colors.slice(0, 8);
  const extraColorCount = colors.length > 8 ? colors.length - 8 : 0;

  return (
    <Card
      className={`cursor-pointer hover-elevate transition-all ${!isEnabled ? "opacity-50" : ""}`}
      onClick={onClick}
      data-testid={`product-card-${item.id}`}
    >
      <div className="relative w-full aspect-[4/5] flex items-center justify-center bg-muted rounded-t-xl p-2">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain"
            data-testid={`img-product-${item.id}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Package className="h-12 w-12" />
          </div>
        )}
        {madeInUSA && (
          <Badge variant="outline" className="absolute top-2 left-2 text-[10px] bg-background/80">
            <Flag className="w-3 h-3 mr-0.5" /> USA
          </Badge>
        )}
        {!isEnabled && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">
            Disabled
          </Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-1.5">
        <h3 className="font-medium text-sm line-clamp-2" data-testid={`text-product-name-${item.id}`}>
          {item.name}
        </h3>
        {item.price != null && item.price > 0 && (
          <span className="text-sm font-bold text-green-600" data-testid={`text-price-${item.id}`}>
            ${item.price.toFixed(2)}
          </span>
        )}
        {previewColors.length > 0 && (
          <div className="flex items-center gap-0.5 flex-wrap">
            {previewColors.map((c, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border border-border"
                style={{ backgroundColor: getColorHex(c) }}
                title={c.name || "Color"}
                data-testid={`swatch-color-${item.id}-${i}`}
              />
            ))}
            {extraColorCount > 0 && (
              <span className="text-[10px] text-muted-foreground ml-0.5">+{extraColorCount}</span>
            )}
          </div>
        )}
        {(item.sizeCount ?? 0) > 0 && (
          <p className="text-[10px] text-muted-foreground" data-testid={`text-sizes-${item.id}`}>{item.sizeCount} sizes</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ProductDetailSkin({
  item,
  actions,
  isActionPending,
}: DetailSkinProps) {
  const [colorsOpen, setColorsOpen] = useState(false);
  const [sizesOpen, setSizesOpen] = useState(false);

  const metadata = (item.metadata || {}) as Record<string, any>;
  const madeInUSA = metadata.originCountry === "US" || metadata.originCountry === "USA" || metadata.madeInUSA === true;
  const isEnabled = metadata.isEnabled !== false;
  const baseCost = typeof metadata.cachedMinCost === "number" ? metadata.cachedMinCost / 100 : 0;
  const qrUpcharge = typeof metadata.qrUpcharge === "number" ? metadata.qrUpcharge : 0.99;
  const markupPercent = typeof metadata.markupPercent === "number" ? metadata.markupPercent : 25;

  const calculatedPrice = baseCost > 0
    ? ((baseCost + qrUpcharge) * (1 + markupPercent / 100))
    : null;
  const displayPrice = item.price ?? calculatedPrice;

  const colors: ColorEntry[] = Array.isArray(metadata.availableColors) ? metadata.availableColors : [];
  const sizes: string[] = Array.isArray(metadata.availableSizes) ? metadata.availableSizes : [];

  return (
    <div className="space-y-4 w-full max-w-md">
      <div className="space-y-2 text-center">
        <h3 className="font-semibold text-lg" data-testid="text-detail-name">
          {item.name}
        </h3>
        <div className="flex flex-wrap gap-1 justify-center">
          {madeInUSA && (
            <Badge variant="outline">
              <Flag className="w-3 h-3 mr-1" /> USA
            </Badge>
          )}
          <Badge variant={isEnabled ? "default" : "secondary"}>
            {isEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-center p-3 bg-muted/30 rounded-md">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Cost</div>
          <div className="text-xs text-muted-foreground" data-testid="text-detail-cost">
            {baseCost > 0 ? `$${baseCost.toFixed(2)}` : "--"}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">+QR</div>
          <div className="text-xs text-muted-foreground">${qrUpcharge.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">+{markupPercent}%</div>
          <div className="text-xs text-muted-foreground">markup</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Price</div>
          <div className="text-lg font-bold text-green-600" data-testid="text-detail-price">
            {displayPrice ? `$${displayPrice.toFixed(2)}` : "--"}
          </div>
        </div>
      </div>

      {colors.length > 0 && (
        <Collapsible open={colorsOpen} onOpenChange={setColorsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/30 rounded-md text-sm" data-testid="toggle-colors">
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              {colors.length} Colors
            </span>
            {colorsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-wrap gap-1.5 p-2" data-testid="list-colors">
              {colors.map((c, i) => (
                <div key={i} className="flex items-center gap-1 text-xs bg-muted/50 rounded-md px-1.5 py-0.5" data-testid={`detail-color-${i}`}>
                  <div
                    className="w-3 h-3 rounded-full border border-border flex-shrink-0"
                    style={{ backgroundColor: getColorHex(c) }}
                  />
                  <span className="truncate max-w-[80px]">{c.name || "Unnamed"}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {sizes.length > 0 && (
        <Collapsible open={sizesOpen} onOpenChange={setSizesOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/30 rounded-md text-sm" data-testid="toggle-sizes">
            <span className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              {sizes.length} Sizes
            </span>
            {sizesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-wrap gap-1.5 p-2" data-testid="list-sizes">
              {sizes.map((size, i) => (
                <Badge key={i} variant="outline" className="text-xs" data-testid={`detail-size-${i}`}>
                  {size || "—"}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
