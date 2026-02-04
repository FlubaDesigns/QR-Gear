import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { nexusFetch } from "@/lib/nexusFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, ExternalLink, Plus, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChannelItem {
  itemId: string;
  packetId: string;
  title: string;
  description?: string;
  previewImageUrl?: string;
  shareUrl: string;
  price?: number;
  collectionTag?: string;
}

interface WidgetSession {
  ok: boolean;
  error?: string;
  storeId: string;
  channelId: string;
  entityType: string;
  entityId: string;
  items: ChannelItem[];
  display: {
    entityName?: string;
    entityLogoUrl?: string;
    placement?: string;
    mode?: string;
    returnUrl?: string;
    theme?: string;
  };
  capabilities: {
    canCreate: boolean;
    canManage: boolean;
  };
}

const ALLOWED_ORIGINS = (import.meta.env.VITE_ALLOWED_WIDGET_ORIGINS || 'https://kingdomconnects.org').split(',');

function notifyParent(type: string, data?: Record<string, unknown>) {
  if (window.parent !== window) {
    const targetOrigin = ALLOWED_ORIGINS[0] || '*';
    window.parent.postMessage({ type: `qrgear:${type}`, ...data }, targetOrigin);
  }
}

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
      <div className="aspect-[9/16] bg-muted relative">
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
          <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground px-2 py-0.5 rounded text-xs">
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
          <p className="text-sm font-semibold mt-1">${(item.price / 100).toFixed(2)}</p>
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

export default function Widget() {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      toast({
        title: "Invalid Widget",
        description: "No authentication token provided",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          notifyParent('height', { height: entry.contentRect.height + 40 });
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const { data: session, isLoading, error } = useQuery<WidgetSession>({
    queryKey: ["/api/widget/session", token],
    queryFn: async () => {
      const url = `/api/widget/session?token=${encodeURIComponent(token!)}`;
      const res = await nexusFetch(url, { source: "widget:session", tries: 3 });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load session');
      }
      return res.json();
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (session?.ok) {
      notifyParent('ready');
    }
  }, [session]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Widget Error",
        description: error.message || "Failed to load widget session",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleShare = (item: ChannelItem) => {
    const shareUrl = `${window.location.origin}${item.shareUrl}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({ title: "Link copied!", description: "Share URL copied to clipboard" });
    });
    notifyParent('item_share', { itemId: item.itemId, packetId: item.packetId });
  };

  const handleView = (item: ChannelItem) => {
    notifyParent('item_click', { itemId: item.itemId, packetId: item.packetId });
    window.open(item.shareUrl, '_blank');
  };

  const handleCreate = () => {
    if (!session) return;
    notifyParent('create_start', { channelId: session.channelId });
    window.open(`/member?channelId=${session.channelId}&entityType=${session.entityType}&entityId=${session.entityId}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !session.ok) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-destructive">Widget Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            {session?.error || "Unable to load widget. Please check your authentication token."}
          </p>
        </Card>
      </div>
    );
  }

  const { items, display, capabilities } = session;
  const isAdminMode = display.mode === 'admin';
  const canCreate = isAdminMode && capabilities.canCreate;

  return (
    <div ref={containerRef} className="p-4 bg-background min-h-[300px]" data-testid="widget-container">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {display.entityLogoUrl && (
            <img 
              src={display.entityLogoUrl} 
              alt={display.entityName || 'Entity'} 
              className="w-10 h-10 rounded-full object-cover"
            />
          )}
          <div>
            <h2 className="font-semibold text-lg" data-testid="text-entity-name">
              {display.entityName || 'Official Items'}
            </h2>
            <p className="text-sm text-muted-foreground">QR Gear Collection</p>
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
          <div className="grid grid-cols-3 gap-3">
            {(showAll ? items : items.slice(0, 3)).map((item) => (
              <ItemCard
                key={item.itemId}
                item={item}
                onShare={() => handleShare(item)}
                onView={() => handleView(item)}
              />
            ))}
          </div>
          {items.length > 3 && (
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
      
      <div className="mt-4 pt-3 border-t text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium">Kingdom Connects</span> × <span className="font-medium text-primary">QR Gear</span>
      </div>
    </div>
  );
}
