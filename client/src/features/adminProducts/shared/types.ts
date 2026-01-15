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
  createdAt?: string;
  updatedAt?: string;
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
}
