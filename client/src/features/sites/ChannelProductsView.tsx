import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, ExternalLink, Package, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSiteContext, notifyParent, type ChannelItem } from "./SiteContext";

function ItemCard({ item, onShare, onView }: {
  item: ChannelItem;
  onShare: () => void;
  onView: () => void;
}) {
  return (
    <Card
      className="overflow-hidden hover-elevate cursor-pointer"
      onClick={onView}
      data-testid={`card-item-${item.itemId}`}
    >
      <div className="aspect-square bg-muted relative">
        {item.previewImageUrl ? (
          <img
            src={item.previewImageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Package className="w-12 h-12" />
          </div>
        )}
        {item.collectionTag && (
          <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-md text-xs">
            {item.collectionTag}
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-medium text-sm truncate" data-testid={`text-title-${item.itemId}`}>
          {item.title}
        </h3>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {item.description}
          </p>
        )}
        {item.price !== undefined && item.price > 0 && (
          <p className="text-sm font-semibold mt-1" data-testid={`text-price-${item.itemId}`}>
            ${(item.price / 100).toFixed(2)}
          </p>
        )}
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            data-testid={`button-share-${item.itemId}`}
          >
            <Share2 className="w-3 h-3 mr-1" />
            Share
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={(e) => { e.stopPropagation(); onView(); }}
            data-testid={`button-view-${item.itemId}`}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChannelProductsView() {
  const { session } = useSiteContext();
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);

  if (!session) return null;

  const { items, display, capabilities } = session;
  const canCreate = session.mode !== 'display' || (display.mode === 'admin' && capabilities.canCreate);

  const handleShare = (item: ChannelItem) => {
    const shareUrl = `${window.location.origin}${item.shareUrl}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({ title: "Link copied!", description: "Share URL copied to clipboard" });
    });
    notifyParent('item_share', { itemId: item.itemId, packetId: item.packetId });
    notifyParent('share_copied', { url: shareUrl });
  };

  const handleView = (item: ChannelItem) => {
    notifyParent('item_click', { itemId: item.itemId, packetId: item.packetId });
    window.open(item.shareUrl, '_blank');
  };

  const handleCreate = () => {
    notifyParent('create_start', { channelId: session.channelId });
    window.open(`/members?channelId=${session.channelId}&entityType=${session.entityType}&entityId=${session.entityId}`, '_blank');
  };

  return (
    <div data-testid="channel-products-view">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {display.entityLogoUrl && (
            <img
              src={display.entityLogoUrl}
              alt={display.entityName || 'Store'}
              className="w-10 h-10 rounded-full object-cover"
            />
          )}
          <div>
            <h2 className="font-semibold text-lg" data-testid="text-entity-name">
              {display.entityName || 'Products'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {canCreate && (
          <Button onClick={handleCreate} data-testid="button-create-item">
            <Plus className="w-4 h-4 mr-2" />
            Create Item
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No items yet</p>
          {canCreate && (
            <Button onClick={handleCreate} className="mt-4" data-testid="button-create-first">
              Create Your First Item
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(showAll ? items : items.slice(0, 6)).map((item) => (
              <ItemCard
                key={item.itemId}
                item={item}
                onShare={() => handleShare(item)}
                onView={() => handleView(item)}
              />
            ))}
          </div>
          {items.length > 6 && (
            <div className="text-center mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                data-testid="button-view-all"
              >
                {showAll ? 'Show less' : `View all ${items.length} items`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
