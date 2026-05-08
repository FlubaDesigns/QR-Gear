export interface GrfAsset {
  id: string;
  grfId: string;
  name: string;
  description: string | null;
  publicUrl: string;
  mimeType: string;
  storagePath: string | null;
  channel: string;
  purpose: string;
  channelName: string | null;
  purposeName: string | null;
  originalFilename: string | null;
  sourceGrfId: string | null;
  tags: string[] | null;
  createdAt: string | null;
  createdBy: string | null;
  isActive: boolean;
}

export interface UploadAssetParams {
  name: string;
  channel: string;
  purpose: string;
  imageData: string;
  mimeType: string;
  sourceGrfId?: string;
  originalFilename?: string;
}

export interface LibraryApi {
  fetchAssets: () => Promise<GrfAsset[]>;
  uploadAsset: (params: UploadAssetParams) => Promise<{ grfId: string }>;
  deleteAsset: (grfId: string) => Promise<void>;
  fetchImageBlob: (url: string) => Promise<string>;
  getQueryKey: () => string[];
  invalidateAssets: () => void;
}

export interface LegacyLibraryAsset {
  id: string;
  name: string;
  assetType?: string;
  mimeType?: string;
  sizeBytes?: number;
  storageUrl?: string;
  publicUrl?: string | null;
  proxyUrl?: string | null;
  width?: number | null;
  height?: number | null;
  sourceAssetId?: string | null;
  isActive?: boolean;
  createdAt?: any;
}

export type LibraryAsset = LegacyLibraryAsset;
export type LibraryAssetWithProxy = LegacyLibraryAsset;

export type AssetType =
  | "source"
  | "cropped"
  | "background"
  | "graphic"
  | "template"
  | "design"
  | "unknown";

export interface LegacyUploadAssetParams {
  name: string;
  assetType: AssetType;
  imageData: string;
  mimeType: string;
  sourceAssetId?: string;
}

export interface LegacyLibraryApi {
  fetchAssets: (type: AssetType) => Promise<LibraryAssetWithProxy[]>;
  uploadAsset: (params: LegacyUploadAssetParams) => Promise<{ id: string; extractedCount?: number }>;
  deleteAsset: (id: string) => Promise<void>;
  fetchImageBlob: (url: string) => Promise<string>;
  getQueryKey: (type: AssetType) => string[];
  invalidateAssets: (type: AssetType) => void;
}

export interface LibraryContextValue {
  storeId: string | null;
  api: LibraryApi;
  legacyApi: LegacyLibraryApi;
  storageRoots: {
    backgrounds: string;
    designs: string;
    videos: string;
  };
  permissions: {
    canUpload: boolean;
    canDelete: boolean;
  };
}
