import { createContext, useContext, type ReactNode } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { adminFetch } from '@/lib/adminFetch';
import { isStoreRole, type StoreRole } from '@shared/storeRoles';
import type { Store, Channel } from '../shared/types';

interface StoreLibraryContextValue {
  selectedType: StoreRole;
  selectedStore: Store | null;
  selectedChannel: Channel | null;
  stores: Store[];
  channels: Channel[];
  loadingStores: boolean;
  loadingChannels: boolean;
  destinationError: string | null;
  retryDestinations: () => void;
  setSelectedType: (role: StoreRole) => void;
  setSelectedStore: (store: Store | null) => void;
  setSelectedChannel: (channel: Channel | null) => void;
}
const StoreLibraryContext = createContext<StoreLibraryContextValue | null>(null);
export function useStoreLibraryContext() {
  const value = useContext(StoreLibraryContext);
  if (!value) throw new Error('Store products must use StoreLibraryProvider');
  return value;
}
/** URL-driven selection prevents late deep-link responses from replacing manual choices. */
export function StoreLibraryProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const storesQuery = useQuery<Store[]>({ queryKey: ['/api/admin/stores'], queryFn: async () => {
    const data = await adminFetch<Store[]>('/stores');
    if (!Array.isArray(data)) throw new Error('Invalid stores response'); return data;
  } });
  const storeId = params.get('storeId');
  const selectedStore = storesQuery.data?.find(s => s.id === storeId) ?? null;
  const role = params.get('role');
  const selectedType = isStoreRole(selectedStore?.roleType) ? selectedStore.roleType : isStoreRole(role) ? role : 'internal';
  const channelsQuery = useQuery<Channel[]>({ queryKey: ['channels', selectedStore?.id], enabled: !!selectedStore,
    queryFn: async () => {
      const data = await adminFetch<Channel[]>(`/stores/${encodeURIComponent(selectedStore!.id)}/channels`);
      if (!Array.isArray(data)) throw new Error('Invalid channels response'); return data;
    },
  });
  const channelKey = params.get('channelId') || params.get('channel');
  const selectedChannel = channelsQuery.data?.find(c => c.id === channelKey || c.name === channelKey) ?? null;
  const destinationError = storesQuery.error ? 'Could not load stores.' : channelsQuery.error ? 'Could not load channels.'
    : storeId && storesQuery.isSuccess && !selectedStore ? 'This store no longer exists. Choose another store.'
    : channelKey && selectedStore && channelsQuery.isSuccess && !selectedChannel ? 'This channel no longer exists. Choose another channel.' : null;
  const select = (nextRole: string, nextStore?: string, nextChannel?: string) => {
    const next = new URLSearchParams(); next.set('role', nextRole);
    if (nextStore) next.set('storeId', nextStore);
    if (nextChannel) next.set('channelId', nextChannel);
    navigate(`/admin/store-library?${next}`);
  };
  return <StoreLibraryContext.Provider value={{ selectedType, selectedStore, selectedChannel,
    stores: (storesQuery.data || []).filter(s => s.roleType === selectedType), channels: channelsQuery.data || [],
    loadingStores: storesQuery.isLoading, loadingChannels: !!selectedStore && channelsQuery.isLoading, destinationError,
    retryDestinations: () => { void storesQuery.refetch(); if (selectedStore) void channelsQuery.refetch(); },
    setSelectedType: role => select(role), setSelectedStore: store => select(selectedType, store?.id),
    setSelectedChannel: channel => select(selectedType, selectedStore?.id, channel?.id),
  }}>{children}</StoreLibraryContext.Provider>;
}
