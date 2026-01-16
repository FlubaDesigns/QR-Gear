import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductsContext } from "../ProductsContext";
import type { Store as StoreType, Channel, RoleType } from "../shared/types";

interface CombinedOption {
  value: string;
  label: string;
  role: RoleType;
  store: StoreType;
  channel: Channel;
}

export function StoreChannelDropdownModule() {
  const { 
    api, 
    setSelectedRole,
    setSelectedStore, 
    selectedStore,
    selectedChannel, 
    setSelectedChannel 
  } = useProductsContext();

  const { data: internalStores = [], isLoading: loadingInternal } = useQuery<StoreType[]>({
    queryKey: ["stores", "internal"],
    queryFn: () => api.fetchStores("internal"),
  });

  const { data: externalStores = [], isLoading: loadingExternal } = useQuery<StoreType[]>({
    queryKey: ["stores", "external"],
    queryFn: () => api.fetchStores("external"),
  });

  const { data: memberStores = [], isLoading: loadingMember } = useQuery<StoreType[]>({
    queryKey: ["stores", "member"],
    queryFn: () => api.fetchStores("member"),
  });

  const allStores = useMemo(() => [
    ...internalStores.map(s => ({ ...s, role: "internal" as RoleType })),
    ...externalStores.map(s => ({ ...s, role: "external" as RoleType })),
    ...memberStores.map(s => ({ ...s, role: "member" as RoleType })),
  ], [internalStores, externalStores, memberStores]);

  const { data: allChannelsMap = {}, isLoading: loadingChannels } = useQuery({
    queryKey: ["all-channels", allStores.map(s => s.id).join(",")],
    queryFn: async () => {
      const channelMap: Record<string, Channel[]> = {};
      await Promise.all(
        allStores.map(async (store) => {
          try {
            const channels = await api.fetchChannels(store.id);
            channelMap[store.id] = channels;
          } catch {
            channelMap[store.id] = [];
          }
        })
      );
      return channelMap;
    },
    enabled: allStores.length > 0,
  });

  const isLoading = loadingInternal || loadingExternal || loadingMember || loadingChannels;

  const combinedOptions = useMemo(() => {
    const options: CombinedOption[] = [];
    allStores.forEach(store => {
      const channels = allChannelsMap[store.id] || [];
      channels.forEach(channel => {
        options.push({
          value: `${store.id}|${channel.id}`,
          label: `${store.name} → ${channel.name}`,
          role: store.role,
          store: store,
          channel,
        });
      });
    });
    return options;
  }, [allStores, allChannelsMap]);

  const handleChange = (value: string) => {
    const option = combinedOptions.find(o => o.value === value);
    if (option) {
      setSelectedRole(option.role);
      setSelectedStore(option.store);
      setSelectedChannel(option.channel);
    }
  };

  const currentValue = selectedStore && selectedChannel 
    ? `${selectedStore.id}|${selectedChannel.id}`
    : "";

  return (
    <div data-testid="module-store-channel-dropdown">
      <Select value={currentValue} onValueChange={handleChange} disabled={isLoading}>
        <SelectTrigger className="w-full min-h-12 text-base" data-testid="select-store-channel">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading stores...
            </span>
          ) : (
            <SelectValue placeholder="Select store and channel..." />
          )}
        </SelectTrigger>
        <SelectContent>
          {combinedOptions.length === 0 && !isLoading && (
            <SelectItem value="_none" disabled>No stores available</SelectItem>
          )}
          {combinedOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value} 
              className="py-3 text-base"
              data-testid={`option-${option.value}`}
            >
              <span className="flex items-center gap-2">
                <Store className="h-5 w-5 flex-shrink-0" />
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default StoreChannelDropdownModule;
