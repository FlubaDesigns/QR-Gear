export * from "./SingleView";
export * from "./ScrollGridView";
export * from "./ScrollVerticalView";
export * from "./ScrollHorizontalView";
export * from "./ModalView";
export * from "./QRDynamicsScanLightbox";

export interface ScrollViewItem {
  id: string | number;
  imageUrl: string;
  title: string;
  subtitle?: string;
  minPrice?: string | null;
  maxPrice?: string | null;
  colorCount?: number;
  madeInUSA?: boolean;
  sizes?: string[];
  description?: string;
  providerDescription?: string | null;
  adminCatalogDescription?: string | null;
  memberPacketDescription?: string | null;
  effectiveDescription?: string | null;
  hasMockupMapping?: boolean;
  metadata?: Record<string, any>;
}

export interface GridViewItem {
  id: string;
  name: string;
  imageUrl: string;
  dimensions?: string;
}

export interface GalleryImage {
  url: string;
  label: string;
}
