import type { BackgroundAsset, LibraryAsset, CustomDesign } from "@shared/schema";

export type AssetType =
  | "raw"
  | "source"
  | "zip"
  | "cropped"
  | "template"
  | "design"
  | "background"
  | "video"
  | "unknown";

export type BackgroundAssetWithProxy = BackgroundAsset & { proxyUrl: string | null };

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

export type { BackgroundAsset, LibraryAsset, CustomDesign };
