import { Button } from "@/components/ui/button";
import { Building2, Users, Globe, Store, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useStoreLibraryContext, StoreType, StoreInfo, ChannelInfo } from "../StoreLibraryContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

const storeTypes: { type: StoreType; label: string; icon: typeof Building2 }[] = [
  { type: "internal", label: "Internal", icon: Building2 },
  { type: "external", label: "External", icon: Globe },
  { type: "member", label: "Member", icon: Users },
];

export function StoreTypeFilterModule() {
  const { 
    selectedType, 
    setSelectedType, 
    selectedStore, 
    setSelectedStore,
    selectedChannel,
    setSelectedChannel,
  } = useStoreLibraryContext();
  const { apiBase } = useAdminAuth();

  const { data: stores = [] } = useQuery<StoreInfo[]>({
    queryKey: [`${apiBase}/stores?roleType=${selectedType}`],
  });

  const { data: channels = [] } = useQuery<ChannelInfo[]>({
    queryKey: [`${apiBase}/stores/${selectedStore?.id}/channels`],
    enabled: !!selectedStore,
  });

  const storeOptions = stores.map(store => ({
    value: store.id,
    label: store.name,
    icon: <Store className="h-4 w-4 flex-shrink-0" />,
  }));

  const channelOptions = channels.map(channel => ({
    value: channel.id,
    label: channel.name,
    icon: <Layers className="h-4 w-4 flex-shrink-0" />,
  }));

  const handleStoreChange = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (store) {
      const storeWithType: StoreInfo = {
        id: store.id,
        name: store.name,
        type: (store as any).roleType || store.type || selectedType,
        description: store.description,
      };
      setSelectedStore(storeWithType);
    } else {
      setSelectedStore(null);
    }
  };

  const handleChannelChange = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    setSelectedChannel(channel || null);
  };

  return (
    <div className="space-y-3" data-testid="module-store-type-filter">
      <div className="flex flex-wrap gap-2">
        {storeTypes.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            variant={selectedType === type ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType(type)}
            className="flex-1 min-w-[90px]"
            data-testid={`button-type-${type}`}
          >
            <Icon className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <CustomDropdown
          value={selectedStore?.id || ""}
          onChange={handleStoreChange}
          options={storeOptions}
          placeholder="Select a store..."
          data-testid="dropdown-store"
        />
        
        {selectedStore && (
          <CustomDropdown
            value={selectedChannel?.id || ""}
            onChange={handleChannelChange}
            options={channelOptions}
            placeholder="Select a channel..."
            data-testid="dropdown-channel"
          />
        )}
      </div>
    </div>
  );
}
