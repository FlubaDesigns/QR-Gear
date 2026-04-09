import { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAdminAuth } from "../shared/AdminAuthContext";
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
  { id: "printful", name: "Printful", configured: true, role: "fulfillment" },
  { id: "printify", name: "Printify", configured: true, role: "fulfillment" },
  { id: "apliiq", name: "Apliiq", configured: false, role: "fulfillment" },
];

const DEFAULT_ROLES: Role[] = [
  { id: "internal", name: "Internal", description: "Products for QR Gear stores and channels", icon: "building" },
  { id: "marketplace", name: "Marketplace", description: "Products listed on Etsy, eBay, Amazon", icon: "shopping-bag" },
  { id: "partner", name: "Partner", description: "Products for partner sites embedding QR Gear UX", icon: "globe" },
  { id: "member", name: "Member", description: "Member-created personalized products", icon: "user" },
];

interface ProductsProviderProps {
  children: React.ReactNode;
}

export function ProductsProvider({ children }: ProductsProviderProps) {
  const { requiresAuth, getAuthHeaders, apiBase } = useAdminAuth();
  const [selectedProviders, setSelectedProvidersState] = useState<string[]>(["printful"]);
  const [selectedRole, setSelectedRoleState] = useState<RoleType | null>(null);
  const [selectedStore, setSelectedStoreState] = useState<Store | null>(null);
  const [selectedChannel, setSelectedChannelState] = useState<Channel | null>(null);
  const [selectedCollection, setSelectedCollectionState] = useState<Collection | null>(null);

  // Fetch actual provider configuration from API
  const { data: apiProviders } = useQuery<FulfillmentProvider[]>({
    queryKey: ["fulfillment-providers", apiBase],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const endpoint = `${apiBase}/fulfillment-providers`;
      try {
        const res = await fetch(endpoint, { headers });
        if (!res.ok) {
          console.warn(`[ProductsContext] Failed to fetch providers (${res.status}), using fallback`);
          return FALLBACK_PROVIDERS;
        }
        return res.json();
      } catch (error) {
        console.warn('[ProductsContext] Error fetching providers, using fallback:', error);
        return FALLBACK_PROVIDERS;
      }
    },
    staleTime: 60000, // Cache for 1 minute
  });

  const providers = apiProviders || FALLBACK_PROVIDERS;

  const setSelectedProviders = useCallback((providers: string[]) => {
    setSelectedProvidersState(providers);
  }, []);

  const setSelectedRole = useCallback((role: RoleType | null) => {
    setSelectedRoleState(role);
  }, []);

  const setSelectedStore = useCallback((store: Store | null) => {
    setSelectedStoreState(store);
  }, []);

  const setSelectedChannel = useCallback((channel: Channel | null) => {
    setSelectedChannelState(channel);
    setSelectedCollectionState(null);
  }, []);

  const setSelectedCollection = useCallback((collection: Collection | null) => {
    setSelectedCollectionState(collection);
  }, []);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const headers = await getAuthHeaders();
        
        const storesRes = await fetch(`${apiBase}/stores?roleType=internal`, { headers });
        if (!storesRes.ok) return;
        const stores: Store[] = await storesRes.json();
        
        const qrGearStore = stores.find(s => s.id === "qr-gear" || s.name.toLowerCase().includes("qr gear"));
        if (!qrGearStore) return;
        
        setSelectedRoleState("internal");
        setSelectedStoreState(qrGearStore);
      } catch (err) {
        console.log("[ProductsContext] Could not load defaults:", err);
      }
    };
    
    loadDefaults();
  }, [apiBase, getAuthHeaders]);

  const api = useMemo<ProductsApi>(() => {
    const getQueryKey = (type: string = "all"): string[] => ["products", apiBase, type];

    const invalidateProducts = (type?: string): void => {
      if (type) {
        queryClient.invalidateQueries({ queryKey: getQueryKey(type) });
      } else {
        queryClient.invalidateQueries({ queryKey: ["products", apiBase] });
      }
    };

    return {
      baseUrl: apiBase,
      getAuthHeaders,
      getQueryKey,
      invalidateProducts,

      fetchProducts: async (provider?: string): Promise<Product[]> => {
        const headers = await getAuthHeaders();
        const providerParam = provider ? `?provider=${provider}` : "";
        const res = await fetch(`${apiBase}/products${providerParam}`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
        return res.json();
      },

      syncCatalog: async (provider?: string): Promise<{ synced: number; syncId?: string }> => {
        const headers = await getAuthHeaders();
        const syncEndpoint = provider === "printful"
          ? `${apiBase}/catalog/sync-printful`
          : `${apiBase}/catalog/sync`;
        const res = await fetch(syncEndpoint, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
        return res.json();
      },

      fetchStores: async (roleType: RoleType): Promise<Store[]> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/stores?roleType=${roleType}`, { headers });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`Failed to fetch stores: ${res.status}`);
        }
        return res.json();
      },

      fetchChannels: async (storeId: string): Promise<Channel[]> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/stores/${storeId}/channels`, { headers });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`Failed to fetch channels: ${res.status}`);
        }
        return res.json();
      },

      fetchCollections: async (storeId: string, channelId: string): Promise<Collection[]> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/stores/${storeId}/channels/${channelId}/collections`, { headers });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`Failed to fetch collections: ${res.status}`);
        }
        const data = await res.json();
        return (data.collections || []).map((name: string) => ({ name }));
      },

      createCollection: async (storeId: string, channelId: string, name: string): Promise<Collection> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/stores/${storeId}/channels/${channelId}/collections`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error(`Failed to create collection: ${res.status}`);
        const data = await res.json();
        return { name: data.name || name };
      },

      fetchLibraryAssets: async (assetType: string): Promise<any[]> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/background-assets?type=${assetType}`, { headers });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`Failed to fetch library assets: ${res.status}`);
        }
        return res.json();
      },
    };
  }, [apiBase, getAuthHeaders]);

  const value = useMemo<ProductsContextValue>(
    () => ({
      requiresAuth,
      api,
      providers,
      selectedProviders,
      setSelectedProviders,
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
      requiresAuth, 
      api, 
      providers,
      selectedProviders, 
      setSelectedProviders,
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
