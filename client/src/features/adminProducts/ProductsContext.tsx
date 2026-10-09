import { STORE_ROLES } from "@shared/storeRoles";
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { requireFulfillmentProvider } from "@shared/fulfillmentSettings";
import { queryClient } from "@/lib/queryClient";
import { adminFetch } from "@/lib/adminFetch";
import type { 
  ProductsContextValue, 
  ProductsApi, 
  Product, 
  FulfillmentProvider,
  Role,
  RoleType,
  Store,
  Channel,
  Collection
} from "./shared/types";

const ProductsContext = createContext<ProductsContextValue | null>(null);

const FALLBACK_PROVIDERS: FulfillmentProvider[] = [
  { id: "printful", name: "Printful", configured: false, role: "fulfillment" },
  { id: "printify", name: "Printify", configured: false, role: "fulfillment" },
  { id: "apliiq", name: "Apliiq", configured: false, role: "fulfillment" },
];

const DEFAULT_ROLES: Role[] = STORE_ROLES.map(role => ({ ...role }));

interface ProductsProviderProps {
  children: React.ReactNode;
}

export function ProductsProvider({ children }: ProductsProviderProps) {
  const [selectedProviders, setSelectedProvidersState] = useState<string[]>([]);
  const providerChosenOrRestored = useRef(false);
  const providerPreferences = useQuery<{ defaultFulfillmentProvider?: string }>({
    queryKey: ["/api/admin/settings"], queryFn: () => adminFetch("/settings"), staleTime: Infinity,
  });
  useEffect(() => {
    if (providerChosenOrRestored.current || !providerPreferences.data?.defaultFulfillmentProvider) return;
    const saved = providerPreferences.data.defaultFulfillmentProvider;
    if (saved === 'printful' || saved === 'printify') setSelectedProvidersState([saved]);
  }, [providerPreferences.data]);
  const saveProviderPreference = useMutation({
    mutationFn: async (value: string) => {
      const provider = requireFulfillmentProvider(value);
      const saved = await adminFetch<{ defaultFulfillmentProvider?: string }>("/settings", {
        method: "PUT", json: { defaultFulfillmentProvider: provider },
      });
      if (saved.defaultFulfillmentProvider !== provider) throw new Error("Your provider preference was not saved. Please retry.");
      return saved;
    },
    onSuccess: saved => queryClient.setQueryData(["/api/admin/settings"], (previous: any) => ({ ...previous, ...saved })),
  });
  const [destination, setDestination] = useState<{
    selectedRole: RoleType | null; selectedStore: Store | null;
    selectedChannel: Channel | null; selectedCollection: Collection | null;
    destinationError: string | null;
  }>({ selectedRole: null, selectedStore: null, selectedChannel: null, selectedCollection: null, destinationError: null });
  const { selectedRole, selectedStore, selectedChannel, selectedCollection, destinationError } = destination;
  const destinationVersion = useRef(0);

  const { data: apiProviders, isLoading: providersLoading, error: providerQueryError } = useQuery<FulfillmentProvider[]>({
    queryKey: ["fulfillment-providers"],
    queryFn: () => adminFetch<FulfillmentProvider[]>("/fulfillment-providers"),
    staleTime: 60000,
  });

  const providers = providerQueryError ? FALLBACK_PROVIDERS : (apiProviders || FALLBACK_PROVIDERS);
  const providersError = providerQueryError ? providerQueryError.message : null;

  const setSelectedProviders = useCallback((providers: string[]) => {
    providerChosenOrRestored.current = true;
    setSelectedProvidersState(providers);
  }, []);

  const setSelectedRole = useCallback((role: RoleType | null) => {
    destinationVersion.current++;
    setDestination(previous => previous.selectedRole === role ? { ...previous, destinationError: null }
      : { selectedRole: role, selectedStore: null, selectedChannel: null, selectedCollection: null, destinationError: null });
  }, []);

  const setSelectedStore = useCallback((store: Store | null) => {
    destinationVersion.current++;
    setDestination(previous => ({
      ...previous, selectedRole: store?.roleType ?? previous.selectedRole, selectedStore: store, destinationError: null,
      ...(store?.id !== previous.selectedStore?.id ? { selectedChannel: null, selectedCollection: null } : {}),
    }));
  }, []);

  const setSelectedChannel = useCallback((channel: Channel | null) => {
    destinationVersion.current++;
    setDestination(previous => {
      // Older committed snapshots omitted the channel parent while retaining its selected store.
      // Preserve explicit parents so crossed-store snapshots still fail validation.
      const restored = channel && !channel.storeId && previous.selectedStore
        ? { ...channel, storeId: previous.selectedStore.id } : channel;
      if (restored && restored.storeId !== previous.selectedStore?.id) {
        return { ...previous, selectedChannel: null, selectedCollection: null, destinationError: 'The selected channel does not belong to this store. Choose a channel again.' };
      }
      return { ...previous, selectedChannel: restored, selectedCollection: null, destinationError: null };
    });
  }, []);

  const setSelectedCollection = useCallback((collection: Collection | null) => {
    destinationVersion.current++;
    setDestination(previous => ({ ...previous, selectedCollection: previous.selectedChannel ? collection : null }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialVersion = destinationVersion.current;
    const loadDefaults = async () => {
      try {
        const stores = await adminFetch<Store[]>("/stores?roleType=internal");
        if (cancelled || destinationVersion.current !== initialVersion) return;
        const qrGearStore = stores.find(s => s.id === "qr-gear" || s.name.toLowerCase().includes("qr gear"));
        if (!qrGearStore) return;
        setDestination(previous => ({ ...previous, selectedRole: "internal", selectedStore: qrGearStore }));
      } catch (err: any) {
        if (!cancelled && destinationVersion.current === initialVersion) {
          setDestination(previous => ({ ...previous, destinationError: `Could not load the default store: ${err.message}` }));
        }
      }
    };
    void loadDefaults();
    return () => { cancelled = true; };
  }, []);

  const api = useMemo<ProductsApi>(() => {
    const getQueryKey = (type: string = "all"): string[] => ["products", type];

    const invalidateProducts = async (type?: string): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: ["/api/master-catalog"] }, { throwOnError: true });
      await queryClient.invalidateQueries({ queryKey: ["joint-catalog-products"] }, { throwOnError: true });
      if (type) {
        await queryClient.invalidateQueries({ queryKey: getQueryKey(type) });
      } else {
        await queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    };

    return {
      getQueryKey,
      invalidateProducts,

      fetchProducts: async (provider?: string): Promise<Product[]> => {
        const providerParam = provider ? `?provider=${provider}` : "";
        return adminFetch<Product[]>(`/products${providerParam}`);
      },

      syncCatalog: async (provider?: string): Promise<{ synced: number; syncId?: string }> => {
        const endpoint = provider === "printful" ? "/catalog/sync-printful" : "/catalog/sync";
        return adminFetch<{ synced: number; syncId?: string }>(endpoint, {
          method: "POST",
          json: { provider },
        });
      },

      fetchStores: (roleType: RoleType): Promise<Store[]> =>
        adminFetch<Store[]>(`/stores?roleType=${encodeURIComponent(roleType)}`),

      fetchChannels: (storeId: string): Promise<Channel[]> =>
        adminFetch<Channel[]>(`/stores/${encodeURIComponent(storeId)}/channels`),

      fetchCollections: async (storeId: string, channelId: string): Promise<Collection[]> => {
        const data = await adminFetch<{ collections: string[] }>(`/stores/${encodeURIComponent(storeId)}/channels/${encodeURIComponent(channelId)}/collections`);
        return data.collections.map((name: string) => ({ name }));
      },

      createCollection: async (storeId: string, channelId: string, name: string): Promise<Collection> => {
        const data = await adminFetch<{ name?: string }>(`/stores/${storeId}/channels/${channelId}/collections`, {
          method: "POST",
          json: { name },
        });
        return { name: data.name || name };
      },

      fetchLibraryAssets: async (purpose: string): Promise<any[]> => {
        try {
          return await adminFetch<any[]>(`/graphics?purpose=${purpose}`);
        } catch (err: any) {
          if (err?.message?.includes("404")) return [];
          throw err;
        }
      },
    };
  }, []);

  const value = useMemo<ProductsContextValue>(
    () => ({
      requiresAuth: true,
      api,
      providers,
      providersLoading,
      providersError,
      destinationError,
      selectedProviders,
      setSelectedProviders,
      preferredProvider: providerPreferences.data?.defaultFulfillmentProvider ?? null,
      providerPreferenceLoading: providerPreferences.isLoading,
      providerPreferenceError: saveProviderPreference.error?.message || providerPreferences.error?.message || null,
      providerPreferenceSaving: saveProviderPreference.isPending,
      saveProviderPreference: saveProviderPreference.mutateAsync,
      reloadProviderPreference: providerPreferences.refetch,
      roles: DEFAULT_ROLES,
      selectedRole,
      setSelectedRole,
      selectedStore,
      setSelectedStore,
      selectedChannel,
      setSelectedChannel,
      selectedCollection,
      setSelectedCollection,
    }),
    [
      api, 
      providers,
      providersLoading,
      providersError,
      destinationError,
      selectedProviders, 
      setSelectedProviders,
      providerPreferences.data, providerPreferences.isLoading, providerPreferences.error,
      providerPreferences.refetch, saveProviderPreference.error, saveProviderPreference.isPending, saveProviderPreference.mutateAsync,
      selectedRole,
      setSelectedRole,
      selectedStore,
      setSelectedStore,
      selectedChannel,
      setSelectedChannel,
      selectedCollection,
      setSelectedCollection,
    ]
  );

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProductsContext(): ProductsContextValue {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error("useProductsContext must be used within ProductsProvider");
  }
  return context;
}
