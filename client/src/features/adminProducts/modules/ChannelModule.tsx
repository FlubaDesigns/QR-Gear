import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Layers, Plus, Loader2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useProductsContext } from "../ProductsContext";
import type { Channel } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

export function ChannelModule() {
  const { 
    api, 
    selectedStore, 
    selectedChannel, 
    setSelectedChannel 
  } = useProductsContext();
  const { toast } = useToast();
  
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");

  const { data: channels = [], isLoading } = useQuery<Channel[]>({
    queryKey: ["channels", selectedStore?.id],
    queryFn: () => selectedStore ? api.fetchChannels(selectedStore.id) : Promise.resolve([]),
    enabled: !!selectedStore,
  });

  const createChannelMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/stores/${selectedStore!.id}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create channel");
      }
      return res.json();
    },
    onSuccess: (newChannel) => {
      queryClient.invalidateQueries({ queryKey: ["channels", selectedStore?.id] });
      setSelectedChannel(newChannel);
      setNewChannelName("");
      setShowAddChannel(false);
      toast({ title: "Channel created", description: `"${newChannel.name}" is ready to use.` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create channel", description: error.message, variant: "destructive" });
    },
  });

  const handleChannelSelect = (channel: Channel) => {
    if (selectedChannel?.id === channel.id) {
      setSelectedChannel(null);
    } else {
      setSelectedChannel(channel);
    }
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim() || !selectedStore) return;
    createChannelMutation.mutate(newChannelName.trim());
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
                onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
                data-testid="input-channel-name"
              />
              <Button
                size="sm"
                onClick={handleAddChannel}
                disabled={!newChannelName.trim() || createChannelMutation.isPending}
                data-testid="button-save-channel"
              >
                {createChannelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
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
