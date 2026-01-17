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

export type RoleType = 'internal' | 'external' | 'member';

export interface Role {
  id: RoleType;
  name: string;
  description: string;
  icon: string;
}

export interface Store {
  id: string;
  name: string;
  roleType: RoleType;
  isActive: boolean;
  channelCount?: number;
}

export interface Channel {
  id: string;
  name: string;
  storeId: string;
  isActive: boolean;
  productCount?: number;
}

export interface LibraryAsset {
  id: string;
  name: string;
  url?: string;
  proxyUrl?: string;
  thumbnailUrl?: string;
  publicUrl?: string;
  type: string;
  assetType?: string;
  metadata?: Record<string, unknown>;
}

export interface ProductsApi {
  baseUrl: string;
  getAuthHeaders: () => Promise<HeadersInit>;
  getQueryKey: (type: string) => string[];
  invalidateProducts: (type?: string) => void;
  fetchProducts: () => Promise<Product[]>;
  syncCatalog: () => Promise<{ synced: number }>;
  fetchStores: (roleType: RoleType) => Promise<Store[]>;
  fetchChannels: (storeId: string) => Promise<Channel[]>;
  fetchLibraryAssets: (assetType: string) => Promise<LibraryAsset[]>;
}

export interface ProductsContextValue {
  requiresAuth: boolean;
  api: ProductsApi;
  providers: FulfillmentProvider[];
  selectedProviders: string[];
  setSelectedProviders: (providers: string[]) => void;
  selectedRole: RoleType | null;
  setSelectedRole: (role: RoleType | null) => void;
  selectedStore: Store | null;
  setSelectedStore: (store: Store | null) => void;
  selectedChannel: Channel | null;
  setSelectedChannel: (channel: Channel | null) => void;
  roles: Role[];
}
