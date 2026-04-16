import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export interface ScrollVerticalViewProps<T extends { id: string | number }> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  height?: string;
  maxItemWidth?: string;
  emptyMessage?: string;
  footer?: React.ReactNode;
  className?: string;
}

export function ScrollVerticalView<T extends { id: string | number }>({
  items,
  renderItem,
  height,
  maxItemWidth = "420px",
  emptyMessage = "No items available",
  footer,
  className,
}: ScrollVerticalViewProps<T>) {
  if (items.length === 0) {
    return (
      <div className="w-full text-center py-8 text-sm text-muted-foreground" data-testid="empty-scroll-vertical">
        {emptyMessage}
      </div>
    );
  }

  const grid = (
    <div className="grid grid-cols-1 gap-4 py-2 px-1" data-testid="scroll-vertical-container">
      {items.map((item, index) => (
        <div key={item.id} className="mx-auto w-full" style={{ maxWidth: maxItemWidth }}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`relative ${className || ""}`}>
      {height ? (
        <ScrollArea style={{ height }} type="scroll" className="w-full">
          {grid}
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      ) : (
        grid
      )}
      {footer !== undefined ? footer : (
        <p className="text-sm text-muted-foreground text-center mt-3 font-medium">
          {items.length} items
        </p>
      )}
    </div>
  );
}
