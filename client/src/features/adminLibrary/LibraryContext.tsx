import { createContext, useContext, useMemo } from "react";
import { queryClient } from "@/lib/queryClient";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import type { LibraryContextValue, LibraryApi, LibraryAssetWithProxy, UploadAssetParams, AssetType } from "./shared/types";

const LibraryContext = createContext<LibraryContextValue | null>(null);

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`Server error: ${res.status}`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error("Upload failed after retries");
}

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
  const { getAuthHeaders, apiBase } = useAdminAuth();

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
        const res = await fetch(`${apiBase}/background-assets?type=${type}`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch assets: ${res.status}`);
        return res.json();
      },

      uploadAsset: async (params: UploadAssetParams): Promise<{ id: string; extractedCount?: number }> => {
        const headers = await getAuthHeaders();
        const res = await fetchWithRetry(`${apiBase}/background-assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Upload failed: ${res.status}` }));
          throw new Error(err.error || `Upload failed: ${res.status}`);
        }
        return res.json();
      },

      uploadZip: async (params: UploadAssetParams): Promise<{ extractedCount: number }> => {
        const headers = await getAuthHeaders();
        const res = await fetchWithRetry(`${apiBase}/background-assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Upload failed: ${res.status}` }));
          throw new Error(err.error || `Upload failed: ${res.status}`);
        }
        return res.json();
      },

      deleteAsset: async (id: string): Promise<void> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiBase}/background-assets/${id}`, {
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
    requiresAuth: true,
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
  }), [storeId, api, storageRoots, permissions]);

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
