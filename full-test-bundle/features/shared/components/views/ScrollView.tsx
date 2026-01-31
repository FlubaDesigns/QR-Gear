import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Palette, DollarSign, AlertTriangle } from "lucide-react";
import UsaFlag from "@/components/UsaFlag";
import { ProductSkin } from "../ProductSkin";

export interface ScrollViewItem {
  id: string | number;
  imageUrl: string;
  title: string;
  subtitle?: string;
  minPrice?: string | null;
  maxPrice?: string | null;
  colorCount?: number;
  madeInUSA?: boolean;
  sizes?: string[];
  description?: string;
  hasMockupMapping?: boolean;
  metadata?: Record<string, any>;
}

export interface ScrollViewProps {
  items: ScrollViewItem[];
  selectedId?: string | number | null;
  onSelect?: (item: ScrollViewItem) => void;
  aspectRatio?: "square" | "portrait" | "landscape";
  itemWidth?: string;
  maxItemWidth?: string;
  emptyMessage?: string;
  layout?: "horizontal" | "grid" | "single" | "vertical";
  gridHeight?: string;
  renderItem?: (item: ScrollViewItem, isSelected: boolean, onSelect: () => void) => React.ReactNode;
}

export function ScrollView({
  items,
  selectedId,
  onSelect,
  aspectRatio = "portrait",
  itemWidth = "calc(50vw - 3rem)",
  maxItemWidth = "180px",
  emptyMessage = "No items available",
  layout = "horizontal",
  gridHeight = "400px",
  renderItem: customRenderItem,
}: ScrollViewProps) {
  const aspectClass =
    aspectRatio === "portrait"
      ? "aspect-[9/16]"
      : aspectRatio === "landscape"
      ? "aspect-[16/9]"
      : "aspect-square";

  if (items.length === 0) {
    return (
      <div className="w-full text-center py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const renderItem = (item: ScrollViewItem) => {
    const isSelected = selectedId === item.id;
    return (
      <div
        key={item.id}
        className={`cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
          isSelected
            ? "border-primary ring-2 ring-primary ring-offset-2"
            : "border-border hover:border-primary/50"
        }`}
        onClick={() => onSelect?.(item)}
        data-testid={`scroll-item-${item.id}`}
      >
        <div className={`${aspectClass} relative bg-muted`}>
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          {item.hasMockupMapping === false && (
            <div className="absolute top-1 left-1 right-1">
              <Badge 
                variant="destructive" 
                className="text-[9px] px-1 py-0.5 w-full justify-center gap-0.5 bg-orange-500/90"
                data-testid={`badge-no-mapping-${item.id}`}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                Preview Only
              </Badge>
            </div>
          )}
          {item.madeInUSA && (
            <div className="absolute top-1 right-1">
              <UsaFlag className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="p-2 space-y-1">
          <span className="text-xs font-medium truncate block text-center">
            {item.title}
          </span>
          {item.subtitle && (
            <span className="text-xs text-muted-foreground truncate block text-center">
              {item.subtitle}
            </span>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {item.minPrice && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <DollarSign className="w-3 h-3 mr-0.5" />
                {item.minPrice}
              </Badge>
            )}
            {(item.colorCount ?? 0) > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Palette className="w-3 h-3 mr-0.5" />
                {item.colorCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (layout === "grid") {
    return (
      <div className="relative">
        <ScrollArea style={{ height: gridHeight }} type="scroll">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
            {items.map(renderItem)}
          </div>
        </ScrollArea>
        <p className="text-xs text-muted-foreground text-center mt-2">
          {items.length} items • Scroll for more
        </p>
      </div>
    );
  }

  if (layout === "single") {
    return (
      <div className="relative">
        <ScrollArea className="w-full" type="scroll">
          <div className="flex gap-4 pb-2 snap-x snap-mandatory" style={{ width: "max-content" }}>
            {items.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 snap-center"
                style={{ width: "min(280px, 80vw)" }}
              >
                {renderItem(item)}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <p className="text-xs text-muted-foreground text-center mt-2">
          {items.length} items • Swipe for more
        </p>
      </div>
    );
  }

  if (layout === "vertical") {
    return (
      <div className="relative">
        <div 
          className="overflow-y-auto overscroll-contain touch-pan-y pr-2"
          style={{ 
            height: gridHeight, 
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="grid grid-cols-1 gap-4 p-1">
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              
              if (customRenderItem) {
                return (
                  <div key={item.id}>
                    {customRenderItem(item, isSelected, () => onSelect?.(item))}
                  </div>
                );
              }
              
              const priceRange = item.minPrice && item.maxPrice 
                ? { min: parseFloat(item.minPrice), max: parseFloat(item.maxPrice) }
                : item.minPrice 
                  ? { min: parseFloat(item.minPrice), max: parseFloat(item.minPrice) }
                  : undefined;
              
              return (
                <ProductSkin
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  brand={item.subtitle}
                  image={item.imageUrl}
                  priceRange={priceRange}
                  madeInUSA={item.madeInUSA}
                  colors={item.colorCount}
                  sizes={item.sizes}
                  description={item.description}
                  onClick={() => onSelect?.(item)}
                  className={isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
                />
              );
            })}
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center mt-3 font-medium">
          {items.length} products available
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <ScrollArea className="w-full" type="scroll">
        <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0"
              style={{ width: itemWidth, maxWidth: maxItemWidth }}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Tap to select • Scroll for more
      </p>
    </div>
  );
}
