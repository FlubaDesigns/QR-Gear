import { Badge } from "@/components/ui/badge";
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
      className="group relative rounded-lg border-2 border-border overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={() => onAction?.(item)}
      data-testid={`channel-item-${item.id}`}
    >
      <div className="aspect-[9/16] relative bg-muted">
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

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-primary text-primary-foreground rounded-full p-3">
              <Plus className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-2 bg-card">
        <p className="text-xs font-medium truncate text-center">
          {item.name}
        </p>
      </div>
    </div>
  );
}
