export interface Product {
  id: string;
  name: string;
  description?: string;
  blueprintId?: number;
  printProviderId?: number;
  customerPrice?: string;
  isEnabled?: boolean;
  category?: string;
  imageUrl?: string;
  printifyId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface FulfillmentProvider {
  id: string;
  name: string;
  configured: boolean;
  role: 'fulfillment' | 'mockup';
}

export interface ProductsApi {
  getQueryKey: (type: string) => string[];
  invalidateProducts: (type?: string) => void;
  fetchProducts: () => Promise<Product[]>;
  syncCatalog: () => Promise<{ synced: number }>;
}

export interface ProductsContextValue {
  requiresAuth: boolean;
  api: ProductsApi;
  providers: FulfillmentProvider[];
  selectedProviders: string[];
  setSelectedProviders: (providers: string[]) => void;
}
