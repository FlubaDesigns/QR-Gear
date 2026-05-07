import { createContext, useContext, useMemo } from "react";
import { queryClient } from "@/lib/queryClient";
import { adminFetch } from "@/lib/adminFetch";
import type { LibraryContextValue, LibraryApi, UploadAssetParams } from "./shared/types";

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
    const getQueryKey = (typeCode: string): string[] => ["/api/admin/graphics", typeCode];

    const invalidateAssets = (typeCode: string): void => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(typeCode) });
    };

    return {
      getQueryKey,
      invalidateAssets,

      fetchAssets: (typeCode: string) =>
        adminFetch(`/graphics?typeCode=${typeCode}`),

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
