import { createContext, useContext, useMemo } from "react";
import { queryClient } from "@/lib/queryClient";
import { adminFetch } from "@/lib/adminFetch";
import type { LibraryContextValue, LibraryApi, LibraryAssetWithProxy, UploadAssetParams, AssetType } from "./shared/types";

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
    const getQueryKey = (type: AssetType): string[] => ["library", "/api/admin", "grf", type];

    const invalidateAssets = (type: AssetType): void => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(type) });
    };

    return {
      getQueryKey,
      invalidateAssets,

      // All asset reads go through grf_assets now
      fetchAssets: (typeCode: AssetType) =>
        adminFetch<LibraryAssetWithProxy[]>(`/graphics?typeCode=${typeCode}`),

      // Upload/mint: callers should POST to /api/admin/graphics/save-grf directly.
      // These shims keep old callers compiling but should not be reachable from
      // the current UI (all legacy Source/Cropped/Backgrounds tabs are removed).
      uploadAsset: (_params: UploadAssetParams) => {
        throw new Error("uploadAsset: legacy library_assets upload removed. Use /api/admin/graphics/save-grf.");
      },

      uploadZip: (_params: UploadAssetParams) => {
        throw new Error("uploadZip: legacy library_assets upload removed.");
      },

      deleteAsset: (_id: string) => {
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

  const value = useMemo<LibraryContextValue>(() => ({
    api,
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
  }), [api, storeId, storageRoots, permissions]);

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
