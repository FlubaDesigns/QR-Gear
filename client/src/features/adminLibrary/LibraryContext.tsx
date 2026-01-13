import { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { LibraryContextValue } from "./shared/types";

const defaultContext: LibraryContextValue = {
  storeId: null,
  apiBase: "/api",
  storageRoots: {
    backgrounds: "libraries/backgrounds",
    source: "libraries/source",
    cropped: "libraries/cropped",
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
  const { user } = useAuth();

  const value = useMemo<LibraryContextValue>(() => ({
    storeId: storeId ?? user?.id ?? null,
    apiBase: apiBase ?? defaultContext.apiBase,
    storageRoots: {
      ...defaultContext.storageRoots,
      ...storageRoots,
    },
    permissions: {
      ...defaultContext.permissions,
      ...permissions,
    },
  }), [storeId, apiBase, storageRoots, permissions, user?.id]);

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
