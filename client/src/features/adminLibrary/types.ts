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

/**
 * Your API returns backgrounds with a computed proxyUrl field
 * so the client can render images consistently.
 */
export type BackgroundAssetWithProxy = BackgroundAsset & { proxyUrl: string | null };

/**
 * Context used across all Library tabs.
 * Keep this stable so tabs/services don't fight each other.
 */
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

// Re-export shared schema types for convenience in feature code
export type { BackgroundAsset, LibraryAsset, CustomDesign };
