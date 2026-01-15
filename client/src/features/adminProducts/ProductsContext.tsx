import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { useAdminAuth } from "../shared/AdminAuthContext";
import type { ProductsContextValue, ProductsApi, Product, FulfillmentProvider } from "./shared/types";

const ProductsContext = createContext<ProductsContextValue | null>(null);

const DEFAULT_PROVIDERS: FulfillmentProvider[] = [
  { id: "printify", name: "Printify", configured: true, role: "fulfillment" },
  { id: "printful", name: "Printful", configured: true, role: "fulfillment" },
  { id: "apliiq", name: "Apliiq", configured: false, role: "fulfillment" },
];

interface ProductsProviderProps {
  children: React.ReactNode;
}

export function ProductsProvider({ children }: ProductsProviderProps) {
  const { requiresAuth, getAuthHeaders, apiBase } = useAdminAuth();
  const [selectedProviders, setSelectedProvidersState] = useState<string[]>(["printify", "printful"]);

  const setSelectedProviders = useCallback((providers: string[]) => {
    setSelectedProvidersState(providers);
  }, []);

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
      getQueryKey,
      invalidateProducts,

      fetchProducts: async (): Promise<Product[]> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/admin/products`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
        return res.json();
      },

      syncCatalog: async (): Promise<{ synced: number }> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/admin/products/sync`, {
          method: "POST",
          headers,
        });
        if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
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
    }),
    [requiresAuth, api, selectedProviders, setSelectedProviders]
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
