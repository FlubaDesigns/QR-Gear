import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export interface ScrollHorizontalViewProps<T extends { id: string | number }> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemWidth?: string;
  maxItemWidth?: string;
  snap?: boolean;
  emptyMessage?: string;
  footer?: React.ReactNode;
  className?: string;
}

export function ScrollHorizontalView<T extends { id: string | number }>({
  items,
  renderItem,
  itemWidth = "calc(50vw - 3rem)",
  maxItemWidth = "180px",
  snap = false,
  emptyMessage = "No items available",
  footer,
  className,
}: ScrollHorizontalViewProps<T>) {
  if (items.length === 0) {
    return (
      <div className="w-full text-center py-8 text-sm text-muted-foreground" data-testid="empty-scroll-horizontal">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`relative ${className || ""}`}>
      <ScrollArea className="w-full" type="scroll">
        <div
          className={`flex gap-3 pb-2 ${snap ? "snap-x snap-mandatory" : ""}`}
          style={{ width: "max-content" }}
          data-testid="scroll-horizontal-container"
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`flex-shrink-0 ${snap ? "snap-center" : ""}`}
              style={{
                width: snap ? "min(280px, 80vw)" : itemWidth,
                maxWidth: snap ? undefined : maxItemWidth,
              }}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {footer !== undefined ? footer : (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {items.length} items {snap ? "- Swipe for more" : "- Scroll for more"}
        </p>
      )}
    </div>
  );
}
