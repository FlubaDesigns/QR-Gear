import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store, Plus, Minus, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useProductsContext } from "../ProductsContext";
import type { Store as StoreType, Channel, RoleType } from "../shared/types";

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

  const [showAddStore, setShowAddStore] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newChannelName, setNewChannelName] = useState("");

  // Fetch stores for all roles
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

  // Fetch channels for selected store
  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["channels", selectedStore?.id],
    queryFn: () => selectedStore ? api.fetchChannels(selectedStore.id) : Promise.resolve([]),
    enabled: !!selectedStore,
  });

  const isLoading = loadingInternal || loadingExternal || loadingMember;

  const handleStoreChange = (storeId: string) => {
    const store = allStores.find(s => s.id === storeId);
    if (store) {
      setSelectedRole(store.role);
      setSelectedStore(store);
      setSelectedChannel(null);
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    if (selectedChannel?.id === channel.id) {
      setSelectedChannel(null);
    } else {
      setSelectedChannel(channel);
    }
  };

  const handleAddStore = () => {
    if (!newStoreName.trim()) return;
    console.log("TODO: Add store", newStoreName);
    setNewStoreName("");
    setShowAddStore(false);
  };

  const handleDeleteStore = () => {
    if (!selectedStore) return;
    console.log("TODO: Delete store", selectedStore.id);
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim() || !selectedStore) return;
    console.log("TODO: Add channel", newChannelName, selectedStore.id);
    setNewChannelName("");
    setShowAddChannel(false);
  };

  const handleDeleteChannel = (channel: Channel) => {
    console.log("TODO: Delete channel", channel.id);
  };

  return (
    <div className="glass-card space-y-6" data-testid="module-store-channel">
      {/* Store Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="glass-subtitle uppercase tracking-wider">Store</label>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddStore(!showAddStore)}
              className="qr-btn qr-btn--icon-touch qr-btn--ghost"
              title="Add Store"
              data-testid="button-add-store"
            >
              <Plus className="h-5 w-5" />
            </button>
            {selectedStore && (
              <button
                onClick={handleDeleteStore}
                className="qr-btn qr-btn--icon-touch qr-btn--ghost"
                title="Delete Store"
                data-testid="button-delete-store"
              >
                <Minus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <Select value={selectedStore?.id || ""} onValueChange={handleStoreChange} disabled={isLoading}>
          <SelectTrigger className="w-full min-h-14 text-lg" data-testid="select-store">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading stores...
              </span>
            ) : (
              <SelectValue placeholder="Select a store..." />
            )}
          </SelectTrigger>
          <SelectContent>
            {allStores.length === 0 && !isLoading && (
              <SelectItem value="_none" disabled>No stores available</SelectItem>
            )}
            {allStores.map((store) => (
              <SelectItem 
                key={store.id} 
                value={store.id} 
                className="py-4 text-lg"
                data-testid={`option-store-${store.id}`}
              >
                <span className="flex items-center gap-3">
                  <Store className="h-5 w-5 flex-shrink-0" />
                  {store.name}
                  <span className="text-sm opacity-60">({store.role})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showAddStore && (
          <div className="flex items-center gap-3 p-3 glass-button rounded-lg">
            <Input
              placeholder="New store name..."
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              className="flex-1 min-h-12 text-base"
              inputMode="text"
              data-testid="input-new-store"
            />
            <button
              onClick={handleAddStore}
              disabled={!newStoreName.trim()}
              className="qr-btn qr-btn--primary qr-btn--touch"
              data-testid="button-save-store"
            >
              Save
            </button>
            <button
              onClick={() => { setShowAddStore(false); setNewStoreName(""); }}
              className="qr-btn qr-btn--ghost qr-btn--touch"
              data-testid="button-cancel-store"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Channel Selection */}
      {selectedStore && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="glass-subtitle uppercase tracking-wider">Channels</label>
            <button
              onClick={() => setShowAddChannel(!showAddChannel)}
              className="qr-btn qr-btn--icon-touch qr-btn--ghost"
              title="Add Channel"
              data-testid="button-add-channel"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {loadingChannels ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading channels...</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {channels.length === 0 ? (
                <p className="glass-body opacity-70 py-2">No channels yet. Add one to get started.</p>
              ) : (
                channels.map((channel) => {
                  const isSelected = selectedChannel?.id === channel.id;
                  return (
                    <div key={channel.id} className="flex items-center gap-1">
                      <button
                        onClick={() => handleChannelSelect(channel)}
                        className={`qr-btn qr-btn--touch ${isSelected ? 'qr-btn--primary' : 'qr-btn--outline'}`}
                        data-testid={`button-channel-${channel.id}`}
                      >
                        {channel.name}
                        {channel.productCount !== undefined && channel.productCount > 0 && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-sm">
                            {channel.productCount}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(channel)}
                        className="qr-btn qr-btn--icon-touch qr-btn--ghost opacity-60 hover:opacity-100"
                        title="Delete Channel"
                        data-testid={`button-delete-channel-${channel.id}`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {showAddChannel && (
            <div className="flex items-center gap-3 p-3 glass-button rounded-lg">
              <Input
                placeholder="New channel name..."
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="flex-1 min-h-12 text-base"
                inputMode="text"
                data-testid="input-new-channel"
              />
              <button
                onClick={handleAddChannel}
                disabled={!newChannelName.trim()}
                className="qr-btn qr-btn--primary qr-btn--touch"
                data-testid="button-save-channel"
              >
                Save
              </button>
              <button
                onClick={() => { setShowAddChannel(false); setNewChannelName(""); }}
                className="qr-btn qr-btn--ghost qr-btn--touch"
                data-testid="button-cancel-channel"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StoreChannelDropdownModule;
