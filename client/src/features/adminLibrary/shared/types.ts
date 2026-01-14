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
}
