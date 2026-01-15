import { createContext, useContext, useMemo, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { queryClient } from "@/lib/queryClient";
import type { LibraryContextValue, LibraryApi, LibraryAssetWithProxy, UploadAssetParams, AssetType } from "./shared/types";

const LibraryContext = createContext<LibraryContextValue | null>(null);

interface LibraryProviderProps {
  children: React.ReactNode;
  storeId?: string | null;
  apiBase?: string;
  storageRoots?: Partial<LibraryContextValue["storageRoots"]>;
  permissions?: Partial<LibraryContextValue["permissions"]>;
}

export function LibraryProvider({
  children,
  storeId,
  apiBase = "/api",
  storageRoots,
  permissions,
}: LibraryProviderProps) {
  const requiresAuth = !apiBase.includes("/test");

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!requiresAuth) return {};
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }, [requiresAuth]);

  const api = useMemo<LibraryApi>(() => {
    const getQueryKey = (type: AssetType): string[] => ["library", apiBase, "assets", type];

    const invalidateAssets = (type: AssetType): void => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(type) });
    };

    return {
      getQueryKey,
      invalidateAssets,

      fetchAssets: async (type: AssetType): Promise<LibraryAssetWithProxy[]> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/admin/background-assets?type=${type}`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
        return res.json();
      },

      uploadAsset: async (params: UploadAssetParams): Promise<{ id: string; extractedCount?: number }> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/admin/background-assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Upload failed: ${res.status}`);
        }
        return res.json();
      },

      uploadZip: async (params: UploadAssetParams): Promise<{ extractedCount: number }> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/admin/background-assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Upload failed: ${res.status}`);
        }
        return res.json();
      },

      deleteAsset: async (id: string): Promise<void> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/admin/background-assets/${id}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      },

      fetchImageBlob: async (url: string): Promise<string> => {
        const headers = await getAuthHeaders();
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      },
    };
  }, [apiBase, getAuthHeaders]);

  const value = useMemo<LibraryContextValue>(() => ({
    storeId: storeId ?? null,
    requiresAuth,
    api,
    storageRoots: {
      backgrounds: "library/backgrounds",
      source: "library/source",
      cropped: "library/cropped",
      ...storageRoots,
    },
    permissions: {
      canUpload: true,
      canDelete: true,
      canEdit: true,
      ...permissions,
    },
  }), [storeId, requiresAuth, api, storageRoots, permissions]);

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibraryContext(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibraryContext must be used within LibraryProvider");
  return ctx;
}

export { LibraryContext };
