import { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [selectedProviders, setSelectedProvidersState] = useState<string[]>(["printful"]);
  const [selectedRole, setSelectedRoleState] = useState<RoleType | null>(null);
  const [selectedStore, setSelectedStoreState] = useState<Store | null>(null);
  const [selectedChannel, setSelectedChannelState] = useState<Channel | null>(null);
  const [selectedCollection, setSelectedCollectionState] = useState<Collection | null>(null);

  const { data: apiProviders } = useQuery<FulfillmentProvider[]>({
    queryKey: ["fulfillment-providers"],
    queryFn: async () => {
      try {
        return await adminFetch<FulfillmentProvider[]>("/fulfillment-providers");
      } catch (error) {
        console.warn("[ProductsContext] Error fetching providers, using fallback:", error);
        return FALLBACK_PROVIDERS;
      }
    },
    staleTime: 60000,
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
        const stores = await adminFetch<Store[]>("/stores?roleType=internal");
        const qrGearStore = stores.find(s => s.id === "qr-gear" || s.name.toLowerCase().includes("qr gear"));
        if (!qrGearStore) return;
        setSelectedRoleState("internal");
        setSelectedStoreState(qrGearStore);
      } catch (err) {
        console.log("[ProductsContext] Could not load defaults:", err);
      }
    };
    loadDefaults();
  }, []);

  const api = useMemo<ProductsApi>(() => {
    const getQueryKey = (type: string = "all"): string[] => ["products", type];

    const invalidateProducts = (type?: string): void => {
      if (type) {
        queryClient.invalidateQueries({ queryKey: getQueryKey(type) });
      } else {
        queryClient.invalidateQueries({ queryKey: ["products"] });
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

      fetchStores: async (roleType: RoleType): Promise<Store[]> => {
        try {
          return await adminFetch<Store[]>(`/stores?roleType=${roleType}`);
        } catch (err: any) {
          if (err?.message?.includes("404")) return [];
          throw err;
        }
      },

      fetchChannels: async (storeId: string): Promise<Channel[]> => {
        try {
          return await adminFetch<Channel[]>(`/stores/${storeId}/channels`);
        } catch (err: any) {
          if (err?.message?.includes("404")) return [];
          throw err;
        }
      },

      fetchCollections: async (storeId: string, channelId: string): Promise<Collection[]> => {
        try {
          const data = await adminFetch<{ collections: string[] }>(`/stores/${storeId}/channels/${channelId}/collections`);
          return (data.collections || []).map((name: string) => ({ name }));
        } catch (err: any) {
          if (err?.message?.includes("404")) return [];
          throw err;
        }
      },

      createCollection: async (storeId: string, channelId: string, name: string): Promise<Collection> => {
        const data = await adminFetch<{ name?: string }>(`/stores/${storeId}/channels/${channelId}/collections`, {
          method: "POST",
          json: { name },
        });
        return { name: data.name || name };
      },

      fetchLibraryAssets: async (assetType: string): Promise<any[]> => {
        try {
          return await adminFetch<any[]>(`/background-assets?type=${assetType}`);
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
