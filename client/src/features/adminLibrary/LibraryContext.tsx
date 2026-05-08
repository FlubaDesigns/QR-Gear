import { createContext, useContext, useMemo } from "react";
import { queryClient } from "@/lib/queryClient";
import { adminFetch } from "@/lib/adminFetch";
import type {
  LibraryContextValue,
  LibraryApi,
  LegacyLibraryApi,
  UploadAssetParams,
  LegacyUploadAssetParams,
  AssetType,
} from "./shared/types";

const LibraryContext = createContext<LibraryContextValue | null>(null);

interface LibraryProviderProps {
  children: React.ReactNode;
  storeId?: string | null;
  storageRoots?: Partial<LibraryContextValue["storageRoots"]>;
  permissions?: Partial<LibraryContextValue["permissions"]>;
}

export function LibraryProvider({
  children,
  storeId,
  storageRoots,
  permissions,
}: LibraryProviderProps) {
  const api = useMemo<LibraryApi>(() => {
    const getQueryKey = (): string[] => ["/api/admin/graphics"];

    const invalidateAssets = (): void => {
      queryClient.invalidateQueries({ queryKey: getQueryKey() });
    };

    return {
      getQueryKey,
      invalidateAssets,

      fetchAssets: () =>
        adminFetch(`/graphics`),

      uploadAsset: (_params: UploadAssetParams): Promise<{ grfId: string }> => {
        throw new Error("uploadAsset: use POST /api/admin/graphics/save-grf directly.");
      },

      deleteAsset: (_grfId: string): Promise<void> => {
        throw new Error("deleteAsset: use PATCH /api/admin/graphics/:grfId/archive instead.");
      },

      fetchImageBlob: async (url: string): Promise<string> => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      },
    };
  }, []);

  const legacyApi = useMemo<LegacyLibraryApi>(() => {
    const getQueryKey = (type: AssetType): string[] => ["library", "/api/admin", "assets", type];

    const invalidateAssets = (type: AssetType): void => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(type) });
    };

    return {
      getQueryKey,
      invalidateAssets,

      fetchAssets: (type: AssetType) =>
        adminFetch(`/background-assets?type=${type}`),

      uploadAsset: (params: LegacyUploadAssetParams) =>
        adminFetch(`/background-assets`, { method: "POST", json: params }),

      deleteAsset: (id: string) =>
        adminFetch(`/background-assets/${id}`, { method: "DELETE" }).then(() => {}),

      fetchImageBlob: async (url: string): Promise<string> => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      },
    };
  }, []);

  const value = useMemo<LibraryContextValue>(() => ({
    api,
    legacyApi,
    storeId: storeId ?? null,
    storageRoots: {
      backgrounds: "library/backgrounds",
      designs: "library/designs",
      videos: "library/videos",
      ...(storageRoots ?? {}),
    },
    permissions: {
      canUpload: true,
      canDelete: true,
      ...(permissions ?? {}),
    },
  }), [api, legacyApi, storeId, storageRoots, permissions]);

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within a LibraryProvider");
  return ctx;
}

export function useLibraryContext(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibraryContext must be used within a LibraryProvider");
  return ctx;
}
