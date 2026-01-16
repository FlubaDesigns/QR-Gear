import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Minus, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    ...internalStores,
    ...externalStores,
    ...memberStores,
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
      setSelectedRole(store.roleType);
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

  const queryClient = useQueryClient();

  // Create channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async ({ storeId, name }: { storeId: string; name: string }) => {
      const headers = await api.getAuthHeaders();
      const isTestEndpoint = api.baseUrl.includes("/test");
      const adminSegment = isTestEndpoint ? "" : "/admin";
      const res = await fetch(`${api.baseUrl}${adminSegment}/stores/${storeId}/channels`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`Failed to create channel: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", selectedStore?.id] });
      setNewChannelName("");
      setShowAddChannel(false);
    },
  });

  // Delete channel mutation
  const deleteChannelMutation = useMutation({
    mutationFn: async ({ storeId, channelId }: { storeId: string; channelId: string }) => {
      const headers = await api.getAuthHeaders();
      const isTestEndpoint = api.baseUrl.includes("/test");
      const adminSegment = isTestEndpoint ? "" : "/admin";
      const res = await fetch(`${api.baseUrl}${adminSegment}/stores/${storeId}/channels/${channelId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error(`Failed to delete channel: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", selectedStore?.id] });
      if (selectedChannel) setSelectedChannel(null);
    },
  });

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
    createChannelMutation.mutate({ storeId: selectedStore.id, name: newChannelName });
  };

  const handleDeleteChannel = (channel: Channel) => {
    if (!selectedStore) return;
    deleteChannelMutation.mutate({ storeId: selectedStore.id, channelId: channel.id });
  };

  const roles: RoleType[] = ["internal", "external", "member"];

  const handleRoleChange = (role: RoleType) => {
    setSelectedRole(role);
    setSelectedStore(null);
    setSelectedChannel(null);
  };

  // Filter stores by selected role
  const filteredStores = useMemo(() => {
    if (!selectedRole) return allStores;
    return allStores.filter(s => s.roleType === selectedRole);
  }, [allStores, selectedRole]);

  return (
    <div className="glass-card space-y-6" data-testid="module-store-channel">
      {/* Role Selection - FIRST */}
      <div className="space-y-3">
        <label className="glass-subtitle uppercase tracking-wider">Role</label>
        <div className="flex flex-wrap gap-3">
          {roles.map((role) => {
            const isSelected = selectedRole === role;
            const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
            return (
              <button
                key={role}
                onClick={() => handleRoleChange(role)}
                className={`qr-btn qr-btn--touch ${isSelected ? 'qr-btn--primary' : 'qr-btn--outline'}`}
                data-testid={`button-role-${role}`}
              >
                {roleLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Store Selection - SECOND */}
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
            {filteredStores.length === 0 && !isLoading && (
              <SelectItem value="_none" disabled>
                {selectedRole ? `No ${selectedRole} stores` : "Select a role first"}
              </SelectItem>
            )}
            {filteredStores.map((store) => (
              <SelectItem 
                key={store.id} 
                value={store.id} 
                className="py-4 text-lg"
                data-testid={`option-store-${store.id}`}
              >
                <span className="flex items-center gap-3">
                  <Store className="h-5 w-5 flex-shrink-0" />
                  {store.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showAddStore && (
          <div className="flex flex-col gap-3 p-4 glass-button rounded-lg">
            <input
              type="text"
              placeholder="New store name..."
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStore()}
              className="w-full min-h-14 text-lg px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-ice-2"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="words"
              spellCheck="false"
              enterKeyHint="done"
              data-testid="input-new-store"
            />
            <div className="flex gap-3">
              <button
                onClick={handleAddStore}
                disabled={!newStoreName.trim()}
                className="qr-btn qr-btn--primary qr-btn--touch flex-1"
                data-testid="button-save-store"
              >
                Save
              </button>
              <button
                onClick={() => { setShowAddStore(false); setNewStoreName(""); }}
                className="qr-btn qr-btn--ghost qr-btn--touch flex-1"
                data-testid="button-cancel-store"
              >
                Cancel
              </button>
            </div>
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
            <div className="flex flex-col gap-3 p-4 glass-button rounded-lg">
              <input
                type="text"
                placeholder="New channel name..."
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()}
                className="w-full min-h-14 text-lg px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-ice-2"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="words"
                spellCheck="false"
                enterKeyHint="done"
                data-testid="input-new-channel"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleAddChannel}
                  disabled={!newChannelName.trim() || createChannelMutation.isPending}
                  className="qr-btn qr-btn--primary qr-btn--touch flex-1"
                  data-testid="button-save-channel"
                >
                  {createChannelMutation.isPending ? (
                    <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Saving...</>
                  ) : "Save"}
                </button>
                <button
                  onClick={() => { setShowAddChannel(false); setNewChannelName(""); }}
                  className="qr-btn qr-btn--ghost qr-btn--touch flex-1"
                  data-testid="button-cancel-channel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StoreChannelDropdownModule;
