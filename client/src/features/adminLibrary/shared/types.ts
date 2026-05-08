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

export interface LibraryContextValue {
  storeId: string | null;
  api: LibraryApi;
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

export type AssetType = string;
export type LibraryAsset = GrfAsset;
export type LibraryAssetWithProxy = GrfAsset & { proxyUrl?: string | null };
