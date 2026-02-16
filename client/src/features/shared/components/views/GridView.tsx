import { Loader2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface GridViewItem {
  id: string;
  name: string;
  imageUrl: string;
  dimensions?: string;
}

interface GridViewProps {
  items: GridViewItem[];
  onSelect: (item: GridViewItem) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  columns?: string;
}

export function GridView({ 
  items, 
  onSelect, 
  isLoading = false,
  emptyMessage = "No items",
  columns = "grid-cols-2 sm:grid-cols-3"
}: GridViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg">
        <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${columns}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/50 transition-all"
          onClick={() => onSelect(item)}
          data-testid={`card-grid-item-${item.id}`}
        >
          <img
            src={item.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
