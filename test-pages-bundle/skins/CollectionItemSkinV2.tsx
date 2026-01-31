import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Trash2 } from "lucide-react";

export interface CollectionItem {
  id: string;
  name: string;
  imageUrl: string;
  order: number;
  rotationInterval: 'daily' | 'weekly' | 'monthly';
}

interface CollectionItemSkinProps {
  item: CollectionItem;
  onAction?: (item: CollectionItem) => void;
  onRemove?: (item: CollectionItem) => void;
}

const intervalLabels = {
  daily: 'Daily',
  weekly: 'Weekly', 
  monthly: 'Monthly',
};

export function CollectionItemSkinV2({ item, onAction, onRemove }: CollectionItemSkinProps) {
  return (
    <div
      className="group relative rounded-lg border-2 border-border overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onAction?.(item)}
      data-testid={`collection-item-${item.id}`}
    >
      <div className="aspect-[9/16] relative bg-muted">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover"
          data-testid={`img-collection-${item.id}`}
        />
        
        <Badge 
          className="absolute top-2 left-2 bg-primary text-primary-foreground font-bold"
        >
          #{item.order}
        </Badge>

        <Badge 
          variant="outline" 
          className="absolute top-2 right-2 bg-background/80 gap-1"
        >
          <Clock className="h-3 w-3" />
          {intervalLabels[item.rotationInterval]}
        </Badge>

        {onRemove && (
          <Button
            size="icon"
            variant="destructive"
            className="absolute bottom-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
            data-testid={`button-remove-${item.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="p-2 bg-card">
        <p className="text-xs font-medium truncate text-center">
          {item.name}
        </p>
      </div>
    </div>
  );
}
