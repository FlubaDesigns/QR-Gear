import { Badge } from "@/components/ui/badge";
import { Image, Video } from "lucide-react";
import type { CardSkinProps, DetailSkinProps, SkinItem } from "./types";

export interface DynamicsChannelItem extends SkinItem {
  contentType: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
}

const ContentTypeIcon = ({ type }: { type: 'image' | 'video' }) => {
  return type === 'video' 
    ? <Video className="h-4 w-4" /> 
    : <Image className="h-4 w-4" />;
};

const ContentTypeBadge = ({ type }: { type: 'image' | 'video' }) => {
  const labels = { image: 'Landing Page', video: 'Video' };
  return (
    <Badge variant="secondary" className="text-xs gap-1">
      <ContentTypeIcon type={type} />
      {labels[type]}
    </Badge>
  );
};

export function DynamicsChannelCardSkin({ item, onClick }: CardSkinProps) {
  const channelItem = item as DynamicsChannelItem;
  const contentType = channelItem.contentType || 'image';
  const thumbnailUrl = channelItem.thumbnailUrl || channelItem.primaryImage || channelItem.url;

  return (
    <div
      className="group relative bg-card border rounded-md overflow-hidden cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`card-dynamics-channel-${item.id}`}
    >
      <div className="aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={item.name}
            className="w-full h-full object-contain"
            data-testid={`img-channel-${item.id}`}
          />
        ) : (
          <ContentTypeIcon type={contentType} />
        )}
      </div>
      
      <div className="absolute top-2 left-2">
        <ContentTypeBadge type={contentType} />
      </div>

      <div className="p-2">
        <p className="text-sm font-medium truncate" data-testid={`text-channel-name-${item.id}`}>
          {item.name}
        </p>
      </div>

      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-sm font-medium">
          Click to Add
        </span>
      </div>
    </div>
  );
}

export function DynamicsChannelDetailSkin({ item, onClose }: DetailSkinProps) {
  const channelItem = item as DynamicsChannelItem;
  const contentType = channelItem.contentType || 'image';

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{item.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <ContentTypeBadge type={contentType} />
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-center">
        Click on the item in the grid to add it to your collection.
      </p>
    </div>
  );
}
