import { createContext, useContext, useMemo } from "react";
import type { LibraryContextValue } from "./shared/types";

// Default plain fetch (no auth)
function plainFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, options);
}

const defaultContext: LibraryContextValue = {
  storeId: null,
  apiBase: "/api",
  storageRoots: {
    backgrounds: "library/backgrounds",
    source: "library/source",
    cropped: "library/cropped",
  },
  permissions: {
    canUpload: true,
    canDelete: true,
    canEdit: true,
  },
  apiFetch: plainFetch,
};

const LibraryContext = createContext<LibraryContextValue>(defaultContext);

interface LibraryProviderProps {
  children: React.ReactNode;
  storeId?: string | null;
  apiBase?: string;
  storageRoots?: Partial<LibraryContextValue["storageRoots"]>;
  permissions?: Partial<LibraryContextValue["permissions"]>;
  // Page provides its own fetch function (with or without auth)
  apiFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export function LibraryProvider({
  children,
  storeId,
  apiBase,
  storageRoots,
  permissions,
  apiFetch,
}: LibraryProviderProps) {
  const value = useMemo<LibraryContextValue>(() => ({
    storeId: storeId ?? null,
    apiBase: apiBase ?? defaultContext.apiBase,
    storageRoots: {
      ...defaultContext.storageRoots,
      ...storageRoots,
    },
    permissions: {
      ...defaultContext.permissions,
      ...permissions,
    },
    apiFetch: apiFetch ?? plainFetch,
  }), [storeId, apiBase, storageRoots, permissions, apiFetch]);

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibraryContext() {
  return useContext(LibraryContext);
}

export { LibraryContext };
