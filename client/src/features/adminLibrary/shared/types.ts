import type { libraryAssets, customDesigns } from "@shared/schema";

export type AssetType =
  | "source"
  | "cropped"
  | "background"
  | "template"
  | "design"
  | "unknown";

export type LibraryAsset = typeof libraryAssets.$inferSelect;

export type LibraryAssetWithProxy = LibraryAsset & { proxyUrl?: string | null };

export type CustomDesign = typeof customDesigns.$inferSelect;

export type BackgroundAssetWithProxy = LibraryAssetWithProxy;

export interface LibraryContextValue {
  storeId: string | null;
  apiBase: string;
  storageRoots: {
    backgrounds: string;
    source: string;
    cropped: string;
  };
  permissions: {
    canUpload: boolean;
    canDelete: boolean;
    canEdit: boolean;
  };
  // Single fetch function - page decides if it uses auth or not
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function getAssetImageUrl(asset: LibraryAssetWithProxy | null | undefined): string | null {
  if (!asset) return null;
  return asset.proxyUrl || asset.storageUrl || null;
}

export function getAssetThumbnailUrl(asset: LibraryAssetWithProxy | null | undefined): string | null {
  if (!asset) return null;
  return asset.thumbnailUrl || asset.proxyUrl || asset.storageUrl || null;
}
