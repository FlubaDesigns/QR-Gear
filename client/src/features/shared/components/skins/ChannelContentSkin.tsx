import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Image, Video, FileText, Loader2 } from "lucide-react";
import type { CardSkinProps, DetailSkinProps, SkinItem } from "./types";

export interface ChannelContentItem extends SkinItem {
  contentType: 'image' | 'video' | 'document';
  url: string;
  thumbnailUrl?: string;
  metadata?: {
    text?: string;
    duration?: number;
    pageCount?: number;
  };
}

interface ChannelContentCardProps extends CardSkinProps {
  item: ChannelContentItem;
  onAddToCollection?: (id: string) => void;
}

interface ChannelContentDetailProps extends DetailSkinProps {
  item: ChannelContentItem;
  onAddToCollection?: (id: string) => void;
  isAddingToCollection?: boolean;
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

const ContentTypeBadge = ({ type }: { type: 'image' | 'video' | 'document' }) => {
  const labels = { image: 'Image', video: 'Video', document: 'Document' };
  return (
    <Badge variant="secondary" className="text-xs gap-1">
      <ContentTypeIcon type={type} />
      {labels[type]}
    </Badge>
  );
};

export function ChannelContentCardSkin({ 
  item, 
  onClick,
  onAddToCollection 
}: ChannelContentCardProps) {
  const contentItem = item as ChannelContentItem;
  const thumbnailUrl = contentItem.thumbnailUrl || contentItem.primaryImage || contentItem.url;

  return (
    <div
      className="group relative bg-card border rounded-md overflow-hidden cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`card-channel-content-${item.id}`}
    >
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            data-testid={`img-content-${item.id}`}
          />
        ) : (
          <ContentTypeIcon type={contentItem.contentType} />
        )}
      </div>
      
      <div className="absolute top-2 left-2">
        <ContentTypeBadge type={contentItem.contentType} />
      </div>

      <div className="p-2">
        <p className="text-sm font-medium truncate" data-testid={`text-content-name-${item.id}`}>
          {item.name}
        </p>
        {contentItem.metadata?.text && (
          <p className="text-xs text-muted-foreground truncate">
            {contentItem.metadata.text}
          </p>
        )}
      </div>

      <div 
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onAddToCollection?.(item.id);
        }}
      >
        <Button 
          size="sm" 
          className="bg-primary text-primary-foreground"
          data-testid={`button-add-to-collection-${item.id}`}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function ChannelContentDetailSkin({ 
  item, 
  onAddToCollection,
  isAddingToCollection = false,
  onClose 
}: ChannelContentDetailProps) {
  const contentItem = item as ChannelContentItem;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{item.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <ContentTypeBadge type={contentItem.contentType} />
            {contentItem.metadata?.text && (
              <span className="text-sm text-muted-foreground truncate">
                {contentItem.metadata.text}
              </span>
            )}
          </div>
        </div>
      </div>

      {contentItem.contentType === 'video' && contentItem.metadata?.duration && (
        <p className="text-sm text-muted-foreground">
          Duration: {Math.floor(contentItem.metadata.duration / 60)}:{(contentItem.metadata.duration % 60).toString().padStart(2, '0')}
        </p>
      )}

      {contentItem.contentType === 'document' && contentItem.metadata?.pageCount && (
        <p className="text-sm text-muted-foreground">
          Pages: {contentItem.metadata.pageCount}
        </p>
      )}

      <div className="flex gap-2 justify-center pt-2">
        <Button
          onClick={() => onAddToCollection?.(item.id)}
          disabled={isAddingToCollection}
          className="bg-primary text-primary-foreground"
          data-testid="button-add-to-collection-detail"
        >
          {isAddingToCollection ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Add to Collection
        </Button>
      </div>
    </div>
  );
}
