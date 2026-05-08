export type AssetType =
  | "source"
  | "cropped"
  | "background"
  | "template"
  | "design"
  | "unknown";

export interface LibraryAsset {
  id: string;
  name: string;
  assetType: AssetType;
  mediaType?: string;
  mimeType?: string;
  storageUrl?: string;
  publicUrl?: string;
  fileName?: string;
  originalName?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  isActive?: boolean;
  ownerType?: string;
  sourceAssetId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type LibraryAssetWithProxy = LibraryAsset & { proxyUrl?: string | null };

export interface UploadAssetParams {
  name: string;
  assetType: AssetType;
  imageData: string;
  mimeType: string;
  sourceAssetId?: string;
}

export interface LibraryApi {
  fetchAssets: (type: AssetType) => Promise<LibraryAssetWithProxy[]>;
  uploadAsset: (params: UploadAssetParams) => Promise<{ id: string; extractedCount?: number }>;
  uploadZip: (params: UploadAssetParams) => Promise<{ extractedCount: number }>;
  deleteAsset: (id: string) => Promise<void>;
  fetchImageBlob: (url: string) => Promise<string>;
  getQueryKey: (type: AssetType) => string[];
  invalidateAssets: (type: AssetType) => void;
}

export interface LibraryContextValue {
  storeId: string | null;
  requiresAuth: boolean;
  api: LibraryApi;
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
