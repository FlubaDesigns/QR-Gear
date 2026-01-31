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
    <div className={`grid gap-3 ${columns}`}>
      {items.map((item) => (
        <Card
          key={item.id}
          className="overflow-hidden cursor-pointer hover-elevate transition-all"
          onClick={() => onSelect(item)}
          data-testid={`card-grid-item-${item.id}`}
        >
          <div className="relative aspect-square bg-muted">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
            {item.dimensions && (
              <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                {item.dimensions}
              </Badge>
            )}
          </div>
          <CardContent className="p-2">
            <p className="text-xs truncate font-medium">{item.name}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
