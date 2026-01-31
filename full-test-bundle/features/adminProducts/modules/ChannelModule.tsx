import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Layers, Plus, Loader2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useProductsContext } from "../ProductsContext";
import type { Channel } from "../shared/types";

export function ChannelModule() {
  const { 
    api, 
    selectedStore, 
    selectedChannel, 
    setSelectedChannel 
  } = useProductsContext();
  
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");

  const { data: channels = [], isLoading } = useQuery<Channel[]>({
    queryKey: ["channels", selectedStore?.id],
    queryFn: () => selectedStore ? api.fetchChannels(selectedStore.id) : Promise.resolve([]),
    enabled: !!selectedStore,
  });

  const handleChannelSelect = (channel: Channel) => {
    if (selectedChannel?.id === channel.id) {
      setSelectedChannel(null);
    } else {
      setSelectedChannel(channel);
    }
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim()) return;
    console.log("TODO: Add channel", newChannelName, selectedStore?.id);
    setNewChannelName("");
    setShowAddChannel(false);
  };

  if (!selectedStore) {
    return null;
  }

  return (
    <CollapsibleModule
      title={`${selectedStore.name} Channels`}
      icon={<Layers className="h-4 w-4" />}
      defaultOpen={true}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading channels...</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channels yet</p>
            ) : (
              channels.map((channel) => {
                const isSelected = selectedChannel?.id === channel.id;
                return (
                  <Button
                    key={channel.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleChannelSelect(channel)}
                    data-testid={`button-channel-${channel.id}`}
                  >
                    <Layers className="h-3 w-3" />
                    <span>{channel.name}</span>
                    {channel.productCount !== undefined && channel.productCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {channel.productCount}
                      </Badge>
                    )}
                  </Button>
                );
              })
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => setShowAddChannel(!showAddChannel)}
              data-testid="button-add-channel"
            >
              <Plus className="h-3 w-3" />
              Add Channel
            </Button>
          </div>

          {showAddChannel && (
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
              <Input
                placeholder="Channel name..."
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="max-w-xs"
                data-testid="input-channel-name"
              />
              <Button
                size="sm"
                onClick={handleAddChannel}
                disabled={!newChannelName.trim()}
                data-testid="button-save-channel"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddChannel(false);
                  setNewChannelName("");
                }}
                data-testid="button-cancel-channel"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </CollapsibleModule>
  );
}

export default ChannelModule;
