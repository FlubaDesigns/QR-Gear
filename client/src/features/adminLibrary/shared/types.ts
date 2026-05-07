import type { GrfTypeCode } from "@shared/graphicCodes";

export type { GrfTypeCode };

export interface GrfAsset {
  id: string;
  grfId: string;
  name: string;
  description: string | null;
  publicUrl: string;
  mimeType: string;
  storagePath: string | null;
  typeCode: string;
  roleCode: string;
  sourceGrfId: string | null;
  tags: string[] | null;
  createdAt: string | null;
  createdBy: string | null;
  isActive: boolean;
}

export interface UploadAssetParams {
  name: string;
  typeCode: string;
  imageData: string;
  mimeType: string;
  sourceGrfId?: string;
}

export interface LibraryApi {
  fetchAssets: (typeCode: string) => Promise<GrfAsset[]>;
  uploadAsset: (params: UploadAssetParams) => Promise<{ grfId: string }>;
  deleteAsset: (grfId: string) => Promise<void>;
  fetchImageBlob: (url: string) => Promise<string>;
  getQueryKey: (typeCode: string) => string[];
  invalidateAssets: (typeCode: string) => void;
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

// Legacy aliases kept so any remaining import sites compile cleanly
export type AssetType = string;
export type LibraryAsset = GrfAsset;
export type LibraryAssetWithProxy = GrfAsset & { proxyUrl?: string | null };
