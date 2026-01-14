import { createContext, useContext, useMemo } from "react";
import type { LibraryContextValue } from "./shared/types";

const defaultContext: LibraryContextValue = {
  storeId: null,
  apiBase: "/api",
  requiresAuth: true,
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
  storageRoots?: Partial<LibraryContextValue["storageRoots"]>;
  permissions?: Partial<LibraryContextValue["permissions"]>;
}

export function LibraryProvider({
  children,
  storeId,
  apiBase,
  storageRoots,
  permissions,
}: LibraryProviderProps) {
  const resolvedApiBase = apiBase ?? defaultContext.apiBase;
  const requiresAuth = !resolvedApiBase.includes("/test");

  const value = useMemo<LibraryContextValue>(() => ({
    storeId: storeId ?? null,
    apiBase: resolvedApiBase,
    requiresAuth,
    storageRoots: {
      ...defaultContext.storageRoots,
      ...storageRoots,
    },
    permissions: {
      ...defaultContext.permissions,
      ...permissions,
    },
  }), [storeId, resolvedApiBase, requiresAuth, storageRoots, permissions]);

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
