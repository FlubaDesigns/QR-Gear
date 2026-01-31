import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Image, 
  Video, 
  FileText, 
  Clock,
  Loader2,
  GripVertical
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CardSkinProps, DetailSkinProps, SkinItem } from "./types";

export interface CollectionItemData extends SkinItem {
  contentType: 'image' | 'video' | 'document';
  url: string;
  thumbnailUrl?: string;
  order: number;
  rotationInterval: 'daily' | 'weekly' | 'monthly';
  contentId: string;
}

interface CollectionItemCardProps extends CardSkinProps {
  item: CollectionItemData;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onRemove?: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

interface CollectionItemDetailProps extends DetailSkinProps {
  item: CollectionItemData;
  onRemove?: (id: string) => void;
  onUpdateInterval?: (id: string, interval: 'daily' | 'weekly' | 'monthly') => void;
  isUpdating?: boolean;
}

const ContentTypeIcon = ({ type }: { type: 'image' | 'video' | 'document' }) => {
  switch (type) {
    case 'video':
      return <Video className="h-3 w-3" />;
    case 'document':
      return <FileText className="h-3 w-3" />;
    default:
      return <Image className="h-3 w-3" />;
  }
};

const IntervalBadge = ({ interval }: { interval: 'daily' | 'weekly' | 'monthly' }) => {
  const labels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Clock className="h-3 w-3" />
      {labels[interval]}
    </Badge>
  );
};

export function CollectionItemCardSkin({ 
  item, 
  onClick,
  onMoveUp,
  onMoveDown,
  onRemove,
  isFirst = false,
  isLast = false,
}: CollectionItemCardProps) {
  const collectionItem = item as CollectionItemData;
  const thumbnailUrl = collectionItem.thumbnailUrl || collectionItem.primaryImage || collectionItem.url;

  return (
    <div
      className="group relative bg-card border rounded-md overflow-hidden cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`card-collection-item-${item.id}`}
    >
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
        <Badge className="bg-primary text-primary-foreground font-bold">
          #{collectionItem.order}
        </Badge>
      </div>

      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid={`img-collection-item-${item.id}`}
          />
        ) : (
          <ContentTypeIcon type={collectionItem.contentType} />
        )}
      </div>

      <div className="p-2">
        <p className="text-sm font-medium truncate" data-testid={`text-item-name-${item.id}`}>
          {item.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <IntervalBadge interval={collectionItem.rotationInterval} />
        </div>
      </div>

      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp?.(item.id);
          }}
          data-testid={`button-move-up-${item.id}`}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown?.(item.id);
          }}
          data-testid={`button-move-down-${item.id}`}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="destructive"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(item.id);
          }}
          data-testid={`button-remove-${item.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function CollectionItemDetailSkin({ 
  item, 
  onRemove,
  onUpdateInterval,
  isUpdating = false,
  onClose 
}: CollectionItemDetailProps) {
  const collectionItem = item as CollectionItemData;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-bold">
              #{collectionItem.order}
            </Badge>
            <h3 className="text-lg font-semibold truncate">{item.name}</h3>
          </div>
        </div>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Rotation Interval</label>
          <Select
            value={collectionItem.rotationInterval}
            onValueChange={(value: 'daily' | 'weekly' | 'monthly') => {
              onUpdateInterval?.(item.id, value);
            }}
            disabled={isUpdating}
          >
            <SelectTrigger className="w-full" data-testid="select-interval">
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily - Rotates every day</SelectItem>
              <SelectItem value="weekly">Weekly - Rotates every Sunday</SelectItem>
              <SelectItem value="monthly">Monthly - Rotates on the 1st</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isUpdating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating...
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-center pt-2">
        <Button
          variant="destructive"
          onClick={() => onRemove?.(item.id)}
          data-testid="button-remove-detail"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remove from Collection
        </Button>
      </div>
    </div>
  );
}
