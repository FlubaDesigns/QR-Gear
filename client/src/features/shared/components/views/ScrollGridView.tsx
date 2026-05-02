import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Layers } from "lucide-react";

export interface ScrollGridViewProps<T extends { id: string | number }> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  columns?: string;
  /** Fixed height for scroll container. Omit to let content flow naturally (recommended for mobile). */
  height?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  isLoading?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

export function ScrollGridView<T extends { id: string | number }>({
  items,
  renderItem,
  columns = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
  height,
  emptyMessage = "No items available",
  emptyIcon,
  isLoading = false,
  footer,
  className,
}: ScrollGridViewProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-scroll-grid">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg" data-testid="empty-scroll-grid">
        {emptyIcon || <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />}
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const grid = (
    <div className={`grid ${columns} gap-3 p-1`} data-testid="scroll-grid-container">
      {items.map((item, index) => (
        <div key={item.id}>{renderItem(item, index)}</div>
      ))}
    </div>
  );

  return (
    <div className={`relative ${className || ""}`}>
      {height ? (
        <ScrollArea style={{ height }} type="scroll">
          {grid}
        </ScrollArea>
      ) : (
        grid
      )}
      {footer !== undefined ? footer : (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {items.length} items
        </p>
      )}
    </div>
  );
}
