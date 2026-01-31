import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image, Video, Plus } from "lucide-react";

export interface ChannelItem {
  id: string;
  name: string;
  contentType: 'image' | 'video';
  imageUrl: string;
}

interface ChannelItemSkinProps {
  item: ChannelItem;
  onAction?: (item: ChannelItem) => void;
}

export function ChannelItemSkin({ item, onAction }: ChannelItemSkinProps) {
  const ContentIcon = item.contentType === 'video' ? Video : Image;
  
  return (
    <div
      className="relative rounded-lg border-2 border-border overflow-hidden bg-card"
      data-testid={`channel-item-${item.id}`}
    >
      <div className="aspect-[3/4] relative bg-muted">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover"
          data-testid={`img-channel-${item.id}`}
        />
        
        <Badge 
          variant="secondary" 
          className="absolute top-2 left-2 gap-1"
        >
          <ContentIcon className="h-3 w-3" />
          {item.contentType === 'video' ? 'Video' : 'Page'}
        </Badge>
      </div>
      
      <div className="p-2">
        <Button 
          size="sm"
          className="w-full bg-blue-600 hover:bg-blue-700"
          onClick={() => onAction?.(item)}
          data-testid={`button-add-${item.id}`}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}
