import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Trash2, Loader2, Hash, Users, Layers } from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { useProductsContext } from "../ProductsContext";
import { adminFetch } from "@/lib/adminFetch";
import type { Store as StoreType, Channel, Collection, RoleType } from "../shared/types";

export function StoreChannelDropdownModule() {
  const { 
    api, roles, destinationError,
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

  const [mutationError, setMutationError] = useState<string | null>(null);
  const selectionKey = `${selectedRole || ''}/${selectedStore?.id || ''}/${selectedChannel?.id || ''}`;
  const scopeRef = useRef({ key: selectionKey, version: 0 });
  if (scopeRef.current.key !== selectionKey) scopeRef.current = { key: selectionKey, version: scopeRef.current.version + 1 };
  useEffect(() => {
    setShowAddStore(false); setShowAddChannel(false); setShowAddCollection(false);
    setNewStoreName(''); setNewChannelName(''); setNewCollectionName(''); setMutationError(null);
  }, [selectionKey]);
  const onMutate = () => { setMutationError(null); return scopeRef.current.version; };
  const onError = (error: Error) => setMutationError(error.message);

  const { data: stores = [], isLoading: loadingStores, error: storesError } = useQuery<StoreType[]>({
    queryKey: ["stores", selectedRole],
    queryFn: () => api.fetchStores(selectedRole!),
    enabled: !!selectedRole,
  });

  const { data: channels = [], isLoading: loadingChannels, error: channelsError } = useQuery<Channel[]>({
    queryKey: ["channels", selectedStore?.id],
    queryFn: () => selectedStore ? api.fetchChannels(selectedStore.id) : Promise.resolve([]),
    enabled: !!selectedStore,
  });

  const { data: collections = [], isLoading: loadingCollections, error: collectionsError } = useQuery<Collection[]>({
    queryKey: ["collections", selectedStore?.id, selectedChannel?.id],
    queryFn: () =>
      selectedStore && selectedChannel
        ? api.fetchCollections(selectedStore.id, selectedChannel.id)
        : Promise.resolve([]),
    enabled: !!selectedStore && !!selectedChannel,
  });

  const roleOptions = roles.map(role => ({
    value: role.id, label: role.name,
    icon: <Users className="h-4 w-4 flex-shrink-0" />,
  }));

  const storeOptions = stores.map(store => ({
    value: store.id,
    label: store.name,
    icon: <Store className="h-4 w-4 flex-shrink-0" />,
  }));

  const channelOptions = channels.map(channel => ({
    value: channel.id,
    label: channel.productCount ? `${channel.name} (${channel.productCount})` : channel.name,
    icon: <Hash className="h-4 w-4 flex-shrink-0" />,
  }));

  const collectionOptions = [{ value: "", label: "All products" }, ...collections.map(col => ({
    value: col.name,
    label: col.name,
    icon: <Layers className="h-4 w-4 flex-shrink-0" />,
  }))];

  const handleRoleChange = (role: string) => {
    setSelectedRole(role as RoleType);
  };

  const handleStoreChange = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (store) {
      setSelectedStore(store);
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
    onMutate, onError,
    mutationFn: ({ name, roleType }: { name: string; roleType: RoleType }) =>
      adminFetch<StoreType>("/stores", { method: "POST", json: { name, roleType } }),
    onSuccess: (newStore: StoreType, _variables, scope) => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      if (scope !== scopeRef.current.version) return;
      setNewStoreName("");
      setShowAddStore(false);
      if (newStore?.id) {
        setSelectedStore(newStore);
      }
    },
  });

  const deleteStoreMutation = useMutation({
    onMutate, onError,
    mutationFn: (storeId: string) => adminFetch(`/stores/${encodeURIComponent(storeId)}`, { method: "DELETE" }),
    onSuccess: (_data, storeId, scope) => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["channels", storeId] });
      if (scope === scopeRef.current.version) setSelectedStore(null);
    },
  });

  const createChannelMutation = useMutation({
    onMutate, onError,
    mutationFn: ({ storeId, name }: { storeId: string; name: string }) =>
      adminFetch<Channel>(`/stores/${storeId}/channels`, { method: "POST", json: { name } }),
    onSuccess: (newChannel: Channel, variables, scope) => {
      queryClient.invalidateQueries({ queryKey: ["channels", variables.storeId] });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      if (scope !== scopeRef.current.version) return;
      setNewChannelName("");
      setShowAddChannel(false);
      if (newChannel?.id) {
        setSelectedChannel(newChannel);
      }
    },
  });

  const deleteChannelMutation = useMutation({
    onMutate, onError,
    mutationFn: ({ storeId, channelId }: { storeId: string; channelId: string }) =>
      adminFetch(`/stores/${encodeURIComponent(storeId)}/channels/${encodeURIComponent(channelId)}`, { method: "DELETE" }),
    onSuccess: (_data, variables, scope) => {
      queryClient.invalidateQueries({ queryKey: ["channels", variables.storeId] });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      if (scope === scopeRef.current.version) setSelectedChannel(null);
    },
  });

  const createCollectionMutation = useMutation({
    onMutate, onError,
    mutationFn: async ({ storeId, channelId, name }: { storeId: string; channelId: string; name: string }) =>
      api.createCollection(storeId, channelId, name),
    onSuccess: (newCollection, variables, scope) => {
      queryClient.invalidateQueries({ queryKey: ["collections", variables.storeId, variables.channelId] });
      if (scope !== scopeRef.current.version) return;
      setNewCollectionName("");
      setShowAddCollection(false);
      setSelectedCollection(newCollection);
    },
  });

  const handleAddStore = () => {
    if (createStoreMutation.isPending || !newStoreName.trim() || !selectedRole) return;
    createStoreMutation.mutate({ name: newStoreName.trim(), roleType: selectedRole });
  };

  const handleDeleteStore = () => {
    if (deleteStoreMutation.isPending || !selectedStore) return;
    deleteStoreMutation.mutate(selectedStore.id);
  };

  const handleAddChannel = () => {
    if (createChannelMutation.isPending || !newChannelName.trim() || !selectedStore) return;
    createChannelMutation.mutate({ storeId: selectedStore.id, name: newChannelName.trim() });
  };

  const handleAddCollection = () => {
    if (createCollectionMutation.isPending || !newCollectionName.trim() || !selectedStore || !selectedChannel) return;
    createCollectionMutation.mutate({ storeId: selectedStore.id, channelId: selectedChannel.id, name: newCollectionName.trim() });
  };

  const handleDeleteChannel = () => {
    if (deleteChannelMutation.isPending || !selectedStore || !selectedChannel) return;
    deleteChannelMutation.mutate({ storeId: selectedStore.id, channelId: selectedChannel.id });
  };

  return (
    <div className="glass-card space-y-4" data-testid="module-store-channel">
      {(mutationError || destinationError || storesError || channelsError || collectionsError) && (
        <p role="alert" className="text-sm text-red-400">
          {mutationError || destinationError || storesError?.message || channelsError?.message || collectionsError?.message}
        </p>
      )}
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
              loading={!!selectedRole && loadingStores}
              disabled={!selectedRole}
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
