import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Trash2, Loader2, Hash, Users } from "lucide-react";
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

  const queryClient = useQueryClient();

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

  // Filter stores by selected role
  const filteredStores = useMemo(() => {
    if (!selectedRole) return allStores;
    return allStores.filter(s => s.roleType === selectedRole);
  }, [allStores, selectedRole]);

  const roles: RoleType[] = ["internal", "external", "member"];

  // Handlers
  const handleRoleChange = (role: string) => {
    if (role === "_none") return;
    setSelectedRole(role as RoleType);
    setSelectedStore(null);
    setSelectedChannel(null);
  };

  const handleStoreChange = (storeId: string) => {
    if (storeId === "_none" || storeId === "_add") {
      if (storeId === "_add") setShowAddStore(true);
      return;
    }
    const store = allStores.find(s => s.id === storeId);
    if (store) {
      setSelectedRole(store.roleType);
      setSelectedStore(store);
      setSelectedChannel(null);
    }
  };

  const handleChannelChange = (channelId: string) => {
    if (channelId === "_none" || channelId === "_add") {
      if (channelId === "_add") setShowAddChannel(true);
      return;
    }
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      setSelectedChannel(channel);
    }
  };

  // Create store mutation
  const createStoreMutation = useMutation({
    mutationFn: async ({ name, roleType }: { name: string; roleType: RoleType }) => {
      const headers = await api.getAuthHeaders();
      const isTestEndpoint = api.baseUrl.includes("/test");
      const adminSegment = isTestEndpoint ? "" : "/admin";
      const res = await fetch(`${api.baseUrl}${adminSegment}/stores`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name, roleType }),
      });
      if (!res.ok) throw new Error(`Failed to create store: ${res.status}`);
      return res.json();
    },
    onSuccess: (newStore) => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      setNewStoreName("");
      setShowAddStore(false);
      if (newStore?.id) {
        setSelectedStore(newStore);
      }
    },
  });

  // Delete store mutation
  const deleteStoreMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const headers = await api.getAuthHeaders();
      const isTestEndpoint = api.baseUrl.includes("/test");
      const adminSegment = isTestEndpoint ? "" : "/admin";
      const res = await fetch(`${api.baseUrl}${adminSegment}/stores/${storeId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error(`Failed to delete store: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      setSelectedStore(null);
      setSelectedChannel(null);
    },
  });

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
    onSuccess: (newChannel) => {
      queryClient.invalidateQueries({ queryKey: ["channels", selectedStore?.id] });
      setNewChannelName("");
      setShowAddChannel(false);
      if (newChannel?.id) {
        setSelectedChannel(newChannel);
      }
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
      setSelectedChannel(null);
    },
  });

  const handleAddStore = () => {
    if (!newStoreName.trim() || !selectedRole) return;
    createStoreMutation.mutate({ name: newStoreName.trim(), roleType: selectedRole });
  };

  const handleDeleteStore = () => {
    if (!selectedStore) return;
    deleteStoreMutation.mutate(selectedStore.id);
  };

  const handleAddChannel = () => {
    if (!newChannelName.trim() || !selectedStore) return;
    createChannelMutation.mutate({ storeId: selectedStore.id, name: newChannelName.trim() });
  };

  const handleDeleteChannel = () => {
    if (!selectedStore || !selectedChannel) return;
    deleteChannelMutation.mutate({ storeId: selectedStore.id, channelId: selectedChannel.id });
  };

  return (
    <div className="glass-card space-y-4" data-testid="module-store-channel">
      {/* Three dropdowns in a row */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Role Dropdown */}
        <div className="flex-1 min-w-[140px]">
          <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Role</label>
          <Select value={selectedRole || ""} onValueChange={handleRoleChange}>
            <SelectTrigger 
              className="w-full min-h-12 text-base bg-white/10 border-white/20 text-white" 
              data-testid="select-role"
            >
              <SelectValue placeholder="Select role..." />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem 
                  key={role} 
                  value={role} 
                  className="py-3 text-base"
                  data-testid={`option-role-${role}`}
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 flex-shrink-0" />
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Store Dropdown with Add/Delete */}
        <div className="flex-1 min-w-[180px]">
          <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Store</label>
          <div className="flex gap-2">
            <Select 
              value={selectedStore?.id || ""} 
              onValueChange={handleStoreChange} 
              disabled={isLoading || !selectedRole}
            >
              <SelectTrigger 
                className="flex-1 min-h-12 text-base bg-white/10 border-white/20 text-white" 
                data-testid="select-store"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <SelectValue placeholder={selectedRole ? "Select store..." : "Pick role first"} />
                )}
              </SelectTrigger>
              <SelectContent>
                {!selectedRole && (
                  <SelectItem value="_none" disabled>
                    Select a role first
                  </SelectItem>
                )}
                {selectedRole && filteredStores.length === 0 && (
                  <SelectItem value="_none" disabled>
                    No {selectedRole} stores
                  </SelectItem>
                )}
                {filteredStores.map((store) => (
                  <SelectItem 
                    key={store.id} 
                    value={store.id} 
                    className="py-3 text-base"
                    data-testid={`option-store-${store.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <Store className="h-4 w-4 flex-shrink-0" />
                      {store.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setShowAddStore(!showAddStore)}
              disabled={!selectedRole}
              className="qr-btn qr-btn--icon-touch qr-btn--outline disabled:opacity-40"
              title="Add Store"
              data-testid="button-add-store"
            >
              <Plus className="h-5 w-5" />
            </button>
            {selectedStore && (
              <button
                onClick={handleDeleteStore}
                disabled={deleteStoreMutation.isPending}
                className="qr-btn qr-btn--icon-touch qr-btn--outline text-red-400"
                title="Delete Store"
                data-testid="button-delete-store"
              >
                {deleteStoreMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Channel Dropdown with Add/Delete */}
        <div className="flex-1 min-w-[180px]">
          <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Channel</label>
          <div className="flex gap-2">
            <Select 
              value={selectedChannel?.id || ""} 
              onValueChange={handleChannelChange} 
              disabled={loadingChannels || !selectedStore}
            >
              <SelectTrigger 
                className="flex-1 min-h-12 text-base bg-white/10 border-white/20 text-white" 
                data-testid="select-channel"
              >
                {loadingChannels ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <SelectValue placeholder={selectedStore ? "Select channel..." : "Pick store first"} />
                )}
              </SelectTrigger>
              <SelectContent>
                {!selectedStore && (
                  <SelectItem value="_none" disabled>
                    Select a store first
                  </SelectItem>
                )}
                {selectedStore && channels.length === 0 && (
                  <SelectItem value="_none" disabled>
                    No channels yet
                  </SelectItem>
                )}
                {channels.map((channel) => (
                  <SelectItem 
                    key={channel.id} 
                    value={channel.id} 
                    className="py-3 text-base"
                    data-testid={`option-channel-${channel.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <Hash className="h-4 w-4 flex-shrink-0" />
                      {channel.name}
                      {channel.productCount !== undefined && channel.productCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-xs">
                          {channel.productCount}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setShowAddChannel(!showAddChannel)}
              disabled={!selectedStore}
              className="qr-btn qr-btn--icon-touch qr-btn--outline disabled:opacity-40"
              title="Add Channel"
              data-testid="button-add-channel"
            >
              <Plus className="h-5 w-5" />
            </button>
            {selectedChannel && (
              <button
                onClick={handleDeleteChannel}
                disabled={deleteChannelMutation.isPending}
                className="qr-btn qr-btn--icon-touch qr-btn--outline text-red-400"
                title="Delete Channel"
                data-testid="button-delete-channel"
              >
                {deleteChannelMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Store Form */}
      {showAddStore && selectedRole && (
        <div className="flex flex-col gap-3 p-4 glass-button rounded-lg">
          <p className="glass-subtitle text-sm">
            Add new {selectedRole} store:
          </p>
          <input
            type="text"
            placeholder="Store name..."
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStore()}
            className="w-full min-h-12 text-base px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-ice-2"
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
              disabled={!newStoreName.trim() || createStoreMutation.isPending}
              className="qr-btn qr-btn--primary qr-btn--touch flex-1"
              data-testid="button-save-store"
            >
              {createStoreMutation.isPending ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Saving...</>
              ) : "Save Store"}
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

      {/* Add Channel Form */}
      {showAddChannel && selectedStore && (
        <div className="flex flex-col gap-3 p-4 glass-button rounded-lg">
          <p className="glass-subtitle text-sm">
            Add channel to {selectedStore.name}:
          </p>
          <input
            type="text"
            placeholder="Channel name..."
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddChannel()}
            className="w-full min-h-12 text-base px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-ice-2"
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
              ) : "Save Channel"}
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

      {/* Selection Summary */}
      {(selectedRole || selectedStore || selectedChannel) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
          {selectedRole && (
            <span className="px-3 py-1 rounded-full bg-white/10 text-sm glass-body">
              {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
            </span>
          )}
          {selectedStore && (
            <span className="px-3 py-1 rounded-full bg-ice-2/20 text-sm glass-body">
              {selectedStore.name}
            </span>
          )}
          {selectedChannel && (
            <span className="px-3 py-1 rounded-full bg-ice-3/20 text-sm glass-body">
              #{selectedChannel.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StoreChannelDropdownModule;
