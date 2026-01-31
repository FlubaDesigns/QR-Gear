import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List, GalleryHorizontal, Palette, Ruler, Package } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

export type StoreProductViewLayout = "grid" | "list" | "swipe";

export interface StoreProductItem {
  id: string;
  name: string;
  imageUrl: string;
  subtitle?: string;
  colorCount?: number;
  sizeCount?: number;
  sizes?: string[];
  price?: number;
  isSelected?: boolean;
}

export interface StoreProductSkinProps {
  items: StoreProductItem[];
  selectedIds?: Set<string>;
  onSelect?: (item: StoreProductItem) => void;
  onItemClick?: (item: StoreProductItem) => void;
  layout?: StoreProductViewLayout;
  onLayoutChange?: (layout: StoreProductViewLayout) => void;
  initialLayout?: StoreProductViewLayout;
  showViewToggle?: boolean;
  gridHeight?: string;
  emptyMessage?: string;
}

export function StoreProductViewToggle({
  layout,
  onChange,
}: {
  layout: StoreProductViewLayout;
  onChange: (layout: StoreProductViewLayout) => void;
}) {
  return (
    <div className="flex gap-1">
      <Button
        size="icon"
        variant={layout === "grid" ? "default" : "ghost"}
        className="h-7 w-7"
        onClick={() => onChange("grid")}
        data-testid="button-view-grid"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={layout === "list" ? "default" : "ghost"}
        className="h-7 w-7"
        onClick={() => onChange("list")}
        data-testid="button-view-list"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={layout === "swipe" ? "default" : "ghost"}
        className="h-7 w-7"
        onClick={() => onChange("swipe")}
        data-testid="button-view-swipe"
      >
        <GalleryHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ProductCard({
  item,
  isSelected,
  onClick,
  variant = "compact",
}: {
  item: StoreProductItem;
  isSelected: boolean;
  onClick: () => void;
  variant?: "compact" | "full";
}) {
  if (variant === "full") {
    return (
      <Card
        className={`overflow-hidden cursor-pointer hover-elevate transition-all ${
          isSelected ? "ring-2 ring-primary ring-offset-2" : ""
        }`}
        onClick={onClick}
        data-testid={`product-card-${item.id}`}
      >
        <div className="relative aspect-square bg-muted">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          {isSelected && (
            <div className="absolute top-2 right-2">
              <Badge variant="default" className="text-xs">Selected</Badge>
            </div>
          )}
        </div>
        <CardContent className="p-3 space-y-2">
          <h3 className="font-medium text-sm line-clamp-2">{item.name}</h3>
          {item.subtitle && (
            <p className="text-xs text-muted-foreground">{item.subtitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {item.price !== undefined && (
              <div className="text-sm font-semibold">${item.price.toFixed(2)}</div>
            )}
            {(item.colorCount ?? 0) > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Palette className="w-3 h-3" />
                {item.colorCount}
              </Badge>
            )}
            {(item.sizeCount ?? item.sizes?.length ?? 0) > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Ruler className="w-3 h-3" />
                {item.sizeCount ?? item.sizes?.length}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={`relative border rounded-lg p-2 cursor-pointer transition-all ${
        isSelected
          ? "border-primary bg-primary/10 ring-2 ring-primary"
          : "border-border hover:border-primary/50"
      }`}
      onClick={onClick}
      data-testid={`product-card-${item.id}`}
    >
      <div className="aspect-square bg-muted rounded overflow-hidden mb-2">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="text-sm font-medium truncate">{item.name}</div>
      {(item.colorCount ?? 0) > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          {item.colorCount} colors
        </div>
      )}
      {isSelected && (
        <Badge 
          variant="default" 
          className="absolute top-1 right-1 text-[10px] px-1.5 py-0"
        >
          Selected
        </Badge>
      )}
    </div>
  );
}

export function StoreProductSkin({
  items,
  selectedIds = new Set(),
  onSelect,
  onItemClick,
  layout: controlledLayout,
  onLayoutChange,
  initialLayout = "grid",
  showViewToggle = true,
  gridHeight = "400px",
  emptyMessage = "No products available",
}: StoreProductSkinProps) {
  const [internalLayout, setInternalLayout] = useState<StoreProductViewLayout>(initialLayout);
  
  const isControlled = controlledLayout !== undefined;
  const layout = isControlled ? controlledLayout : internalLayout;
  
  const handleLayoutChange = (newLayout: StoreProductViewLayout) => {
    if (isControlled && onLayoutChange) {
      onLayoutChange(newLayout);
    } else {
      setInternalLayout(newLayout);
    }
  };

  const handleClick = (item: StoreProductItem) => {
    if (onItemClick) {
      onItemClick(item);
    } else if (onSelect) {
      onSelect(item);
    }
  };

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        {showViewToggle && (
          <div className="flex justify-end">
            <StoreProductViewToggle layout={layout} onChange={handleLayoutChange} />
          </div>
        )}
        <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg bg-muted/50" data-testid="empty-products">
          {emptyMessage}
        </div>
      </div>
    );
  }

  const renderGridView = () => (
    <ScrollArea style={{ height: gridHeight }} type="scroll">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1" data-testid="grid-products">
        {items.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onClick={() => handleClick(item)}
            variant="compact"
          />
        ))}
      </div>
    </ScrollArea>
  );

  const renderListView = () => (
    <div
      className="overflow-y-auto overscroll-contain touch-pan-y pr-2"
      style={{ height: gridHeight, WebkitOverflowScrolling: "touch" }}
      data-testid="list-products"
    >
      <div className="grid grid-cols-1 gap-4 p-1">
        {items.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onClick={() => handleClick(item)}
            variant="full"
          />
        ))}
      </div>
    </div>
  );

  const renderSwipeView = () => (
    <ScrollArea className="w-full" type="scroll">
      <div className="flex gap-4 pb-2 snap-x snap-mandatory" style={{ width: "max-content" }} data-testid="swipe-products">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0 snap-center"
            style={{ width: "min(280px, 80vw)" }}
          >
            <ProductCard
              item={item}
              isSelected={selectedIds.has(item.id)}
              onClick={() => handleClick(item)}
              variant="full"
            />
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );

  return (
    <div className="space-y-3">
      {showViewToggle && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {items.length} product{items.length !== 1 ? "s" : ""}
            {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
          </p>
          <StoreProductViewToggle layout={layout} onChange={handleLayoutChange} />
        </div>
      )}
      
      {layout === "grid" && renderGridView()}
      {layout === "list" && renderListView()}
      {layout === "swipe" && renderSwipeView()}
    </div>
  );
}

export default StoreProductSkin;
