import { createContext, useContext, useMemo, useCallback } from "react";
import type { LibraryContextValue } from "./shared/types";

const noAuthHeaders = async (): Promise<HeadersInit> => ({});

const defaultContext: LibraryContextValue = {
  storeId: null,
  apiBase: "/api",
  requiresAuth: true,
  getAuthHeaders: noAuthHeaders,
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
};

const LibraryContext = createContext<LibraryContextValue>(defaultContext);

interface LibraryProviderProps {
  children: React.ReactNode;
  storeId?: string | null;
  apiBase?: string;
  getAuthHeaders?: () => Promise<HeadersInit>;
  storageRoots?: Partial<LibraryContextValue["storageRoots"]>;
  permissions?: Partial<LibraryContextValue["permissions"]>;
}

export function LibraryProvider({
  children,
  storeId,
  apiBase,
  getAuthHeaders,
  storageRoots,
  permissions,
}: LibraryProviderProps) {
  const resolvedApiBase = apiBase ?? defaultContext.apiBase;
  const requiresAuth = !resolvedApiBase.includes("/test");
  
  const resolvedGetAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!requiresAuth) return {};
    if (getAuthHeaders) return getAuthHeaders();
    return {};
  }, [requiresAuth, getAuthHeaders]);

  const value = useMemo<LibraryContextValue>(() => ({
    storeId: storeId ?? null,
    apiBase: resolvedApiBase,
    requiresAuth,
    getAuthHeaders: resolvedGetAuthHeaders,
    storageRoots: {
      ...defaultContext.storageRoots,
      ...storageRoots,
    },
    permissions: {
      ...defaultContext.permissions,
      ...permissions,
    },
  }), [storeId, resolvedApiBase, requiresAuth, resolvedGetAuthHeaders, storageRoots, permissions]);

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
