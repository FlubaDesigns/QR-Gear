import { useQuery } from "@tanstack/react-query";
import { Store, Layers, Building2, Globe, User, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductsContext } from "../ProductsContext";
import type { Store as StoreType, Channel, RoleType } from "../shared/types";

const ROLE_OPTIONS: { id: RoleType; label: string; icon: typeof Building2 }[] = [
  { id: "internal", label: "Internal", icon: Building2 },
  { id: "external", label: "External", icon: Globe },
  { id: "member", label: "Member", icon: User },
];

export function StoreChannelDropdownModule() {
  const { 
    api, 
    selectedRole, 
    setSelectedRole,
    selectedStore, 
    setSelectedStore, 
    selectedChannel, 
    setSelectedChannel 
  } = useProductsContext();

  const { data: stores = [], isLoading: storesLoading } = useQuery<StoreType[]>({
    queryKey: ["stores", selectedRole],
    queryFn: () => selectedRole ? api.fetchStores(selectedRole) : Promise.resolve([]),
    enabled: !!selectedRole,
  });

  const { data: channels = [], isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ["channels", selectedStore?.id],
    queryFn: () => selectedStore ? api.fetchChannels(selectedStore.id) : Promise.resolve([]),
    enabled: !!selectedStore,
  });

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId as RoleType);
    setSelectedStore(null);
    setSelectedChannel(null);
  };

  const handleStoreChange = (storeId: string) => {
    const store = stores.find(s => s.id === storeId) || null;
    setSelectedStore(store);
    setSelectedChannel(null);
  };

  const handleChannelChange = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId) || null;
    setSelectedChannel(channel);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 p-3 bg-muted/30 rounded-lg border" data-testid="module-store-channel-dropdown">
      <div className="flex-1 min-w-0">
        <label className="text-xs text-muted-foreground mb-1 block">Role</label>
        <Select value={selectedRole || ""} onValueChange={handleRoleChange}>
          <SelectTrigger className="w-full" data-testid="select-role">
            <SelectValue placeholder="Select role..." />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map(({ id, label, icon: Icon }) => (
              <SelectItem key={id} value={id} data-testid={`option-role-${id}`}>
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-w-0">
        <label className="text-xs text-muted-foreground mb-1 block">Store</label>
        <Select 
          value={selectedStore?.id || ""} 
          onValueChange={handleStoreChange}
          disabled={!selectedRole || storesLoading}
        >
          <SelectTrigger className="w-full" data-testid="select-store">
            {storesLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </span>
            ) : (
              <SelectValue placeholder={selectedRole ? "Select store..." : "Select role first"} />
            )}
          </SelectTrigger>
          <SelectContent>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id} data-testid={`option-store-${store.id}`}>
                <span className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  {store.name}
                </span>
              </SelectItem>
            ))}
            {stores.length === 0 && selectedRole && !storesLoading && (
              <SelectItem value="_none" disabled>No stores found</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-w-0">
        <label className="text-xs text-muted-foreground mb-1 block">Channel</label>
        <Select 
          value={selectedChannel?.id || ""} 
          onValueChange={handleChannelChange}
          disabled={!selectedStore || channelsLoading}
        >
          <SelectTrigger className="w-full" data-testid="select-channel">
            {channelsLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </span>
            ) : (
              <SelectValue placeholder={selectedStore ? "Select channel..." : "Select store first"} />
            )}
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id} data-testid={`option-channel-${channel.id}`}>
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  {channel.name}
                </span>
              </SelectItem>
            ))}
            {channels.length === 0 && selectedStore && !channelsLoading && (
              <SelectItem value="_none" disabled>No channels found</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default StoreChannelDropdownModule;
