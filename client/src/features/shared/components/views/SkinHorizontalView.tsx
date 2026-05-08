import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import type { SkinItem, CardSkinProps } from "../skins/types";

// VVS View code: 2
// Horizontal scroll — renders SkinItem[] in a single scrolling row.
// Owns layout and scroll only. Does not manage selection or popup behavior.

type CardSkinComponent = React.ComponentType<CardSkinProps>;

export interface SkinHorizontalViewProps {
  items: SkinItem[];
  CardSkin: CardSkinComponent;
  onSelect: (item: SkinItem, index: number) => void;
  selectedId?: string | null;
  actions?: import("../skins/types").SkinActions;
  isActionPending?: boolean;
  cardWidth?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function SkinHorizontalView({
  items,
  CardSkin,
  onSelect,
  selectedId,
  actions,
  isActionPending,
  cardWidth = "160px",
  isLoading = false,
  emptyMessage = "No items available.",
  emptyIcon,
  footer,
  className,
}: SkinHorizontalViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loader-skin-horizontal">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg" data-testid="empty-skin-horizontal">
        {emptyIcon}
        <p className="text-muted-foreground text-sm mt-2">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`} data-testid="skin-horizontal-view">
      <ScrollArea className="w-full" type="scroll">
        <div className="flex gap-3 pb-2" style={{ width: "max-content" }}>
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex-shrink-0"
              style={{ width: cardWidth }}
              data-testid={`skin-horizontal-item-${item.id}`}
            >
              <CardSkin
                item={item}
                onClick={() => onSelect(item, index)}
                actions={actions}
                isSelected={selectedId === item.id}
                isActionPending={isActionPending}
              />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {footer !== undefined ? footer : (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {items.length} {items.length === 1 ? "item" : "items"} — scroll to see more
        </p>
      )}
    </div>
  );
}
