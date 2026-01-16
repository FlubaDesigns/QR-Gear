import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useStoreBuilderContext } from "../StoreBuilderContext";

const MOCK_CHANNELS = [
  { id: "channel-1", storeId: "store-1", name: "Main Channel", products: [] },
  { id: "channel-2", storeId: "store-1", name: "Holiday Promo", products: [] },
  { id: "channel-3", storeId: "store-2", name: "User: john@example.com", userId: "user-1", products: [] },
];

export function ChannelPickerModule() {
  const { step, currentStore, currentChannel, setCurrentChannel, setStep } = useStoreBuilderContext();
  const [expanded, setExpanded] = useState(step === "channel");

  if (!currentStore) return null;
  if (step !== "channel" && !currentChannel) return null;

  const storeChannels = MOCK_CHANNELS.filter(c => c.storeId === currentStore.id);

  const handleSelectChannel = (channel: typeof MOCK_CHANNELS[0]) => {
    setCurrentChannel(channel);
    setStep("catalog");
  };

  return (
    <div className="border rounded-lg p-3" data-testid="module-channel-picker">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left font-medium"
        data-testid="toggle-channel-picker"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Layers className="h-4 w-4" />
        <span className="flex-1">Select Channel</span>
        {currentChannel && (
          <Badge variant="secondary">{currentChannel.name}</Badge>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {storeChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No channels yet for this store.</p>
          ) : (
            storeChannels.map(channel => (
              <button
                key={channel.id}
                type="button"
                onClick={() => handleSelectChannel(channel)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  currentChannel?.id === channel.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
                data-testid={`button-channel-${channel.id}`}
              >
                <div className="font-medium">{channel.name}</div>
                {channel.userId && (
                  <div className="text-sm text-muted-foreground">User sandbox</div>
                )}
              </button>
            ))
          )}
          <Button variant="outline" className="w-full" data-testid="button-create-channel">
            <Plus className="h-4 w-4 mr-2" />
            Create New Channel
          </Button>
        </div>
      )}
    </div>
  );
}
