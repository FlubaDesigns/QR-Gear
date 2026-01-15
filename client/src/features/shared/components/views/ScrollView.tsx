import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export interface ScrollViewItem {
  id: string | number;
  imageUrl: string;
  title: string;
  subtitle?: string;
}

export interface ScrollViewProps {
  items: ScrollViewItem[];
  selectedId?: string | number | null;
  onSelect?: (item: ScrollViewItem) => void;
  aspectRatio?: "square" | "portrait" | "landscape";
  itemWidth?: string;
  maxItemWidth?: string;
  emptyMessage?: string;
}

export function ScrollView({
  items,
  selectedId,
  onSelect,
  aspectRatio = "portrait",
  itemWidth = "calc(50vw - 3rem)",
  maxItemWidth = "180px",
  emptyMessage = "No items available",
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

  return (
    <div className="relative">
      <ScrollArea className="w-full" type="scroll">
        <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
          {items.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <div
                key={item.id}
                className={`flex-shrink-0 cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                  isSelected
                    ? "border-primary ring-2 ring-primary ring-offset-2"
                    : "border-border hover:border-primary/50"
                }`}
                style={{ width: itemWidth, maxWidth: maxItemWidth }}
                onClick={() => onSelect?.(item)}
                data-testid={`scroll-item-${item.id}`}
              >
                <div className={`${aspectClass} relative bg-muted`}>
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2 text-center">
                  <span className="text-xs font-medium truncate block">
                    {item.title}
                  </span>
                  {item.subtitle && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {item.subtitle}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Tap to select • Scroll for more
      </p>
    </div>
  );
}
