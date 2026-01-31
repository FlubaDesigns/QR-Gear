import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Layers, Plus, Loader2, Package } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreBuilderContext } from "../StoreBuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";

interface StoreChannel {
  id: string;
  name: string;
  storeId: string;
  isActive: boolean;
  productCount: number;
}

export function ChannelPickerModule() {
  const { step, currentStore, currentChannel, setCurrentChannel, setStep } = useStoreBuilderContext();
  const { apiBase } = useAdminAuth();
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");

  const { data: channels = [], isLoading } = useQuery<StoreChannel[]>({
    queryKey: [`${apiBase}/stores`, currentStore?.id, "channels"],
    enabled: !!currentStore?.id,
  });

  const handleChannelSelect = (channel: StoreChannel) => {
    if (currentChannel?.id === channel.id) {
      setCurrentChannel(null);
    } else {
      setCurrentChannel({
        id: channel.id,
        storeId: channel.storeId,
        name: channel.name,
        products: [],
      });
      if (step === "channel") setStep("catalog");
    }
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim()) return;
    console.log("TODO: Create channel", newChannelName, currentStore?.id);
    setNewChannelName("");
    setShowAddChannel(false);
  };

  if (!currentStore) {
    return null;
  }

  return (
    <CollapsibleModule
      title={`${currentStore.name} Channels`}
      icon={<Layers className="h-4 w-4" />}
      defaultOpen={step === "channel" || !currentChannel}
      badge={currentChannel ? <Badge variant="secondary">{currentChannel.name}</Badge> : undefined}
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
                const isSelected = currentChannel?.id === channel.id;
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
                    {channel.productCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Package className="h-2 w-2 mr-1" />
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
                type="text"
                inputMode="text"
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
