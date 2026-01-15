import { createContext, useContext, useMemo, useCallback } from "react";
import { auth } from "@/lib/firebase";
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
  
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!requiresAuth) return {};
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }, [requiresAuth]);

  const value = useMemo<LibraryContextValue>(() => ({
    storeId: storeId ?? null,
    apiBase: resolvedApiBase,
    requiresAuth,
    getAuthHeaders,
    storageRoots: {
      ...defaultContext.storageRoots,
      ...storageRoots,
    },
    permissions: {
      ...defaultContext.permissions,
      ...permissions,
    },
  }), [storeId, resolvedApiBase, requiresAuth, getAuthHeaders, storageRoots, permissions]);

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
