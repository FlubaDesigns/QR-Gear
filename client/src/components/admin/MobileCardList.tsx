import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export interface MobileCardItem {
  id: string;
  content: ReactNode;
  onClick?: () => void;
}

interface MobileCardListProps {
  items: MobileCardItem[];
  emptyMessage?: string;
  className?: string;
}

export default function MobileCardList({
  items,
  emptyMessage = "No items found",
  className = "",
}: MobileCardListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm" data-testid="card-list-empty">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-testid="mobile-card-list">
      {items.map((item) => (
        <Card
          key={item.id}
          className={`border border-border ${item.onClick ? "cursor-pointer hover-elevate active-elevate-2" : ""}`}
          onClick={item.onClick}
          data-testid={`card-item-${item.id}`}
        >
          <CardContent className="p-3">
            {item.content}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
