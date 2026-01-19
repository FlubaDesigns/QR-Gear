import { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
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
  Channel
} from "./shared/types";

const ProductsContext = createContext<ProductsContextValue | null>(null);

const DEFAULT_PROVIDERS: FulfillmentProvider[] = [
  { id: "printify", name: "Printify", configured: true, role: "fulfillment" },
  { id: "printful", name: "Printful", configured: false, role: "fulfillment" },
  { id: "apliiq", name: "Apliiq", configured: false, role: "fulfillment" },
];

const DEFAULT_ROLES: Role[] = [
  { id: "internal", name: "Internal", description: "Products for QR Gear stores and channels", icon: "building" },
  { id: "external", name: "External", description: "Products for partner stores like Kingdom Connects", icon: "globe" },
  { id: "member", name: "Member", description: "Member-created personalized products", icon: "user" },
];

interface ProductsProviderProps {
  children: React.ReactNode;
}

export function ProductsProvider({ children }: ProductsProviderProps) {
  const { requiresAuth, getAuthHeaders, apiBase } = useAdminAuth();
  const [selectedProviders, setSelectedProvidersState] = useState<string[]>(["printify"]);
  const [selectedRole, setSelectedRoleState] = useState<RoleType | null>(null);
  const [selectedStore, setSelectedStoreState] = useState<Store | null>(null);
  const [selectedChannel, setSelectedChannelState] = useState<Channel | null>(null);

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
  }, []);

  // Auto-load defaults for testing: Internal / QR Gear / Test
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const headers = await getAuthHeaders();
        const isTestEndpoint = apiBase.includes("/test");
        const adminSegment = isTestEndpoint ? "" : "/admin";
        
        // Fetch internal stores
        const storesRes = await fetch(`${apiBase}${adminSegment}/stores?roleType=internal`, { headers });
        if (!storesRes.ok) return;
        const stores: Store[] = await storesRes.json();
        
        // Find QR Gear store
        const qrGearStore = stores.find(s => s.id === "qr-gear" || s.name.toLowerCase().includes("qr gear"));
        if (!qrGearStore) return;
        
        // Fetch channels for QR Gear
        const channelsRes = await fetch(`${apiBase}${adminSegment}/stores/${qrGearStore.id}/channels`, { headers });
        if (!channelsRes.ok) return;
        const channels: Channel[] = await channelsRes.json();
        
        // Find Test channel
        const testChannel = channels.find(c => c.id === "test" || c.name.toLowerCase() === "test");
        
        // Set defaults
        setSelectedRoleState("internal");
        setSelectedStoreState(qrGearStore);
        if (testChannel) {
          setSelectedChannelState(testChannel);
        }
      } catch (err) {
        // Silently fail - defaults are optional
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

      fetchProducts: async (): Promise<Product[]> => {
        const headers = await getAuthHeaders();
        const isTestEndpoint = apiBase.includes("/test");
        const adminSegment = isTestEndpoint ? "" : "/admin";
        const res = await fetch(`${apiBase}${adminSegment}/products`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
        return res.json();
      },

      syncCatalog: async (): Promise<{ synced: number }> => {
        const headers = await getAuthHeaders();
        const isTestEndpoint = apiBase.includes("/test");
        const adminSegment = isTestEndpoint ? "" : "/admin";
        const res = await fetch(`${apiBase}${adminSegment}/products/sync`, {
          method: "POST",
          headers,
        });
        if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
        return res.json();
      },

      fetchStores: async (roleType: RoleType): Promise<Store[]> => {
        const headers = await getAuthHeaders();
        const isTestEndpoint = apiBase.includes("/test");
        const adminSegment = isTestEndpoint ? "" : "/admin";
        const res = await fetch(`${apiBase}${adminSegment}/stores?roleType=${roleType}`, { headers });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`Failed to fetch stores: ${res.status}`);
        }
        return res.json();
      },

      fetchChannels: async (storeId: string): Promise<Channel[]> => {
        const headers = await getAuthHeaders();
        const isTestEndpoint = apiBase.includes("/test");
        const adminSegment = isTestEndpoint ? "" : "/admin";
        const res = await fetch(`${apiBase}${adminSegment}/stores/${storeId}/channels`, { headers });
        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`Failed to fetch channels: ${res.status}`);
        }
        return res.json();
      },

      fetchLibraryAssets: async (assetType: string): Promise<any[]> => {
        const headers = await getAuthHeaders();
        const isTestEndpoint = apiBase.includes("/test");
        const adminSegment = isTestEndpoint ? "" : "/admin";
        const res = await fetch(`${apiBase}${adminSegment}/background-assets?type=${assetType}`, { headers });
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
      providers: DEFAULT_PROVIDERS,
      selectedProviders,
      setSelectedProviders,
      roles: DEFAULT_ROLES,
      selectedRole,
      setSelectedRole,
      selectedStore,
      setSelectedStore,
      selectedChannel,
      setSelectedChannel,
    }),
    [
      requiresAuth, 
      api, 
      selectedProviders, 
      setSelectedProviders,
      selectedRole,
      setSelectedRole,
      selectedStore,
      setSelectedStore,
      selectedChannel,
      setSelectedChannel,
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
