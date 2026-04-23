// Shared storefront types

export interface MockupsByColor {
  [color: string]: { front?: string; lifestyle?: string; angles?: string[] };
}

export interface StoreProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Full ordered gallery array — primary image source. First item is hero. */
  images?: string[] | null;
  packetImageUrl?: string | null;
  /** Firestore segment field — the bridge layer maps this to collection slugs. */
  segment: string | null;
  isFeatured: boolean;
  isSeasonalPromo: boolean;
  templateVariant: string | null;
  qrProductType: string;
  qrCodeUrl?: string | null;
  selectedColors?: string[] | null;
  availableSizes?: string[] | null;
  defaultColor?: string | null;
  mockupsByColor?: MockupsByColor | null;
  price?: number | null;
  createdAt: string;
}

export interface StoreResponse {
  storeType: string;
  storeName: string;
  segment: string | null;
  channelId?: string | null;
  channelName?: string | null;
  collection?: string | null;
  products: StoreProduct[];
}
