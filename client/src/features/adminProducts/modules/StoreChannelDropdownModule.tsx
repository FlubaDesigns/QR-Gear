import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Trash2, Loader2 } from "lucide-react";
import { useProductsContext } from "../ProductsContext";
import type { Store as StoreType, Channel, RoleType } from "../shared/types";

const selectStyles = "w-full min-h-12 text-base px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ice-2 disabled:opacity-50 disabled:cursor-not-allowed";

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

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ["channels", selectedStore?.id],
    queryFn: () => selectedStore ? api.fetchChannels(selectedStore.id) : Promise.resolve([]),
    enabled: !!selectedStore,
  });

  const isLoading = loadingInternal || loadingExternal || loadingMember;

  const filteredStores = useMemo(() => {
    if (!selectedRole) return allStores;
    return allStores.filter(s => s.roleType === selectedRole);
  }, [allStores, selectedRole]);

  const roles: RoleType[] = ["internal", "external", "member"];

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as RoleType;
    if (role) {
      setSelectedRole(role);
      setSelectedStore(null);
      setSelectedChannel(null);
    }
  };

  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const storeId = e.target.value;
    if (storeId) {
      const store = allStores.find(s => s.id === storeId);
      if (store) {
        setSelectedRole(store.roleType);
        setSelectedStore(store);
        setSelectedChannel(null);
      }
    }
  };

  const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const channelId = e.target.value;
    if (channelId) {
      const channel = channels.find(c => c.id === channelId);
      if (channel) {
        setSelectedChannel(channel);
      }
    }
  };

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
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Role</label>
          <div className="relative">
            <select
              value={selectedRole || ""}
              onChange={handleRoleChange}
              className={selectStyles}
              data-testid="select-role"
            >
              <option value="" disabled>Pick a role...</option>
              {roles.map((role) => (
                <option key={role} value={role} data-testid={`option-role-${role}`}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/60">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Store</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedStore?.id || ""}
                onChange={handleStoreChange}
                disabled={isLoading}
                className={selectStyles}
                data-testid="select-store"
              >
                <option value="" disabled>
                  {isLoading ? "Loading..." : "Find your store..."}
                </option>
                {filteredStores.map((store) => (
                  <option key={store.id} value={store.id} data-testid={`option-store-${store.id}`}>
                    {store.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/60">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
            </div>
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

        <div className="flex-1 min-w-[180px]">
          <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Channel</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={selectedChannel?.id || ""}
                onChange={handleChannelChange}
                disabled={loadingChannels || !selectedStore}
                className={selectStyles}
                data-testid="select-channel"
              >
                <option value="" disabled>
                  {loadingChannels ? "Loading..." : "Pick a channel..."}
                </option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id} data-testid={`option-channel-${channel.id}`}>
                    {channel.name} {channel.productCount ? `(${channel.productCount})` : ""}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/60">
                {loadingChannels ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
            </div>
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
