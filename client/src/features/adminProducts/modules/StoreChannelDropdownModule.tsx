import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Trash2, Loader2, Hash, Users, Layers } from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { useProductsContext } from "../ProductsContext";
import type { Store as StoreType, Channel, Collection, RoleType } from "../shared/types";

export function StoreChannelDropdownModule() {
  const { 
    api, 
    selectedRole,
    setSelectedRole,
    selectedStore,
    setSelectedStore, 
    selectedChannel, 
    setSelectedChannel,
    selectedCollection,
    setSelectedCollection,
  } = useProductsContext();

  const [showAddStore, setShowAddStore] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");

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

  const { data: collections = [], isLoading: loadingCollections } = useQuery<Collection[]>({
    queryKey: ["collections", selectedStore?.id, selectedChannel?.id],
    queryFn: () =>
      selectedStore && selectedChannel
        ? api.fetchCollections(selectedStore.id, selectedChannel.id)
        : Promise.resolve([]),
    enabled: !!selectedStore && !!selectedChannel,
  });

  const isLoading = loadingInternal || loadingExternal || loadingMember;

  const filteredStores = useMemo(() => {
    if (!selectedRole) return allStores;
    return allStores.filter(s => s.roleType === selectedRole);
  }, [allStores, selectedRole]);

  const roles: RoleType[] = ["internal", "external", "member"];

  const roleOptions = roles.map(role => ({
    value: role,
    label: role.charAt(0).toUpperCase() + role.slice(1),
    icon: <Users className="h-4 w-4 flex-shrink-0" />,
  }));

  const storeOptions = filteredStores.map(store => ({
    value: store.id,
    label: store.name,
    icon: <Store className="h-4 w-4 flex-shrink-0" />,
  }));

  const channelOptions = channels.map(channel => ({
    value: channel.id,
    label: channel.productCount ? `${channel.name} (${channel.productCount})` : channel.name,
    icon: <Hash className="h-4 w-4 flex-shrink-0" />,
  }));

  const collectionOptions = collections.map(col => ({
    value: col.name,
    label: col.name,
    icon: <Layers className="h-4 w-4 flex-shrink-0" />,
  }));

  const handleRoleChange = (role: string) => {
    setSelectedRole(role as RoleType);
    setSelectedStore(null);
    setSelectedChannel(null);
  };

  const handleStoreChange = (storeId: string) => {
    const store = allStores.find(s => s.id === storeId);
    if (store) {
      setSelectedRole(store.roleType);
      setSelectedStore(store);
      setSelectedChannel(null);
    }
  };

  const handleChannelChange = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      setSelectedChannel(channel);
    }
  };

  const handleCollectionChange = (name: string) => {
    if (!name) {
      setSelectedCollection(null);
    } else {
      setSelectedCollection({ name });
    }
  };

  const createStoreMutation = useMutation({
    mutationFn: async ({ name, roleType }: { name: string; roleType: RoleType }) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/stores`, {
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
      const res = await fetch(`${api.baseUrl}/stores/by-id/${storeId}`, {
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
      const res = await fetch(`${api.baseUrl}/stores/${storeId}/channels`, {
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
      const res = await fetch(`${api.baseUrl}/stores/${storeId}/channels`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) throw new Error(`Failed to delete channel: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", selectedStore?.id] });
      setSelectedChannel(null);
    },
  });

  const createCollectionMutation = useMutation({
    mutationFn: async ({ storeId, channelId, name }: { storeId: string; channelId: string; name: string }) =>
      api.createCollection(storeId, channelId, name),
    onSuccess: (newCollection) => {
      queryClient.invalidateQueries({ queryKey: ["collections", selectedStore?.id, selectedChannel?.id] });
      setNewCollectionName("");
      setShowAddCollection(false);
      setSelectedCollection(newCollection);
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

  const handleAddCollection = () => {
    if (!newCollectionName.trim() || !selectedStore || !selectedChannel) return;
    createCollectionMutation.mutate({ storeId: selectedStore.id, channelId: selectedChannel.id, name: newCollectionName.trim() });
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
          <CustomDropdown
            value={selectedRole || ""}
            onChange={handleRoleChange}
            options={roleOptions}
            placeholder="Pick a role..."
            data-testid="select-role"
          />
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Store</label>
          <div className="flex gap-2">
            <CustomDropdown
              value={selectedStore?.id || ""}
              onChange={handleStoreChange}
              options={storeOptions}
              placeholder="Find your store..."
              loading={isLoading}
              className="flex-1"
              data-testid="select-store"
            />
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
            <CustomDropdown
              value={selectedChannel?.id || ""}
              onChange={handleChannelChange}
              options={channelOptions}
              placeholder="Pick a channel..."
              loading={loadingChannels}
              disabled={!selectedStore}
              className="flex-1"
              data-testid="select-channel"
            />
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

        {selectedChannel && (
          <div className="flex-1 min-w-[180px]">
            <label className="glass-subtitle text-xs uppercase tracking-wider mb-2 block">Collection</label>
            <div className="flex gap-2">
              <CustomDropdown
                value={selectedCollection?.name || ""}
                onChange={handleCollectionChange}
                options={collectionOptions}
                placeholder="All products..."
                loading={loadingCollections}
                className="flex-1"
                data-testid="select-collection"
              />
              <button
                onClick={() => setShowAddCollection(!showAddCollection)}
                className="qr-btn qr-btn--icon-touch qr-btn--outline"
                title="Add Collection"
                data-testid="button-add-collection"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
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

      {showAddCollection && selectedStore && selectedChannel && (
        <div className="flex flex-col gap-3 p-4 glass-button rounded-lg">
          <p className="glass-subtitle text-sm">
            Add collection to #{selectedChannel.name}:
          </p>
          <input
            type="text"
            placeholder="Collection name..."
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCollection()}
            className="w-full min-h-12 text-base px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-ice-2"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck="false"
            enterKeyHint="done"
            data-testid="input-new-collection"
          />
          <div className="flex gap-3">
            <button
              onClick={handleAddCollection}
              disabled={!newCollectionName.trim() || createCollectionMutation.isPending}
              className="qr-btn qr-btn--primary qr-btn--touch flex-1"
              data-testid="button-save-collection"
            >
              {createCollectionMutation.isPending ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Saving...</>
              ) : "Save Collection"}
            </button>
            <button
              onClick={() => { setShowAddCollection(false); setNewCollectionName(""); }}
              className="qr-btn qr-btn--ghost qr-btn--touch flex-1"
              data-testid="button-cancel-collection"
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
          {selectedCollection && (
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-sm glass-body">
              <Layers className="h-3 w-3 inline mr-1" />{selectedCollection.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default StoreChannelDropdownModule;
