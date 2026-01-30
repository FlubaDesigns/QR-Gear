import { ScrollArea } from "@/components/ui/scroll-area";

export interface GridScrollViewProps<T> {
  items: T[];
  Skin: React.ComponentType<{ item: T; onAction?: (item: T) => void }>;
  onAction?: (item: T) => void;
  columns?: number;
  height?: string;
  emptyMessage?: string;
  gap?: string;
}

export function GridScrollView<T extends { id: string | number }>({
  items,
  Skin,
  onAction,
  columns = 4,
  height = "500px",
  emptyMessage = "No items available",
  gap = "gap-3",
}: GridScrollViewProps<T>) {
  
  if (items.length === 0) {
    return (
      <div className="w-full text-center py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const gridCols = 
    columns === 2 ? "grid-cols-2" :
    columns === 3 ? "grid-cols-3" :
    columns === 4 ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" :
    columns === 5 ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" :
    "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";

  return (
    <ScrollArea style={{ height }} type="scroll">
      <div className={`grid ${gridCols} ${gap} p-1`}>
        {items.map((item) => (
          <Skin 
            key={item.id} 
            item={item} 
            onAction={onAction}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
