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

export type RoleType = 'internal' | 'marketplace' | 'partner' | 'external' | 'member';

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

export interface Collection {
  name: string;
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
  fetchProducts: (provider?: string) => Promise<Product[]>;
  syncCatalog: (provider?: string) => Promise<{ synced: number }>;
  fetchStores: (roleType: RoleType) => Promise<Store[]>;
  fetchChannels: (storeId: string) => Promise<Channel[]>;
  fetchCollections: (storeId: string, channelId: string) => Promise<Collection[]>;
  createCollection: (storeId: string, channelId: string, name: string) => Promise<Collection>;
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
  selectedCollection: Collection | null;
  setSelectedCollection: (collection: Collection | null) => void;
  roles: Role[];
}
