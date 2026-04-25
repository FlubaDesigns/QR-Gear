import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Layers, CheckCircle2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreLibraryContext, ChannelInfo } from "../StoreLibraryContext";

export function ChannelListModule() {
  const { selectedStore, selectedChannel, setSelectedChannel } = useStoreLibraryContext();

  const { data: channels = [], isLoading, error } = useQuery<ChannelInfo[]>({
    queryKey: ["/api/admin/stores", selectedStore?.id, "channels"],
    enabled: !!selectedStore,
  });

  if (!selectedStore) {
    return null;
  }

  const handleSelectChannel = (channel: ChannelInfo) => {
    setSelectedChannel(channel);
  };

  return (
    <CollapsibleModule
      title="Select Channel"
      badge={selectedChannel?.name}
      defaultOpen={true}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4" data-testid="loader-channels">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive p-2" data-testid="error-channels">
          Failed to load channels
        </div>
      ) : channels.length === 0 ? (
        <div className="text-sm text-muted-foreground p-2" data-testid="empty-channels">
          No channels found for this store
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" data-testid="list-channels">
          {channels.map((channel) => (
            <Button
              key={channel.id}
              variant={selectedChannel?.id === channel.id ? "default" : "outline"}
              className="justify-start h-auto py-2"
              onClick={() => handleSelectChannel(channel)}
              data-testid={`button-channel-${channel.id}`}
            >
              {selectedChannel?.id === channel.id ? (
                <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" />
              ) : (
                <Layers className="h-4 w-4 mr-2 shrink-0" />
              )}
              <div className="text-left">
                <div className="font-medium">{channel.name}</div>
                {channel.description && (
                  <div className="text-xs opacity-70">{channel.description}</div>
                )}
              </div>
            </Button>
          ))}
        </div>
      )}
    </CollapsibleModule>
  );
}
