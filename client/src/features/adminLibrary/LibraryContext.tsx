import { createContext, useContext, useMemo, useCallback } from "react";
import { auth } from "@/lib/firebase";
import type { LibraryContextValue } from "./shared/types";

// Authenticated fetch that includes Firebase token
async function createAuthFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  // Only set Content-Type for non-FormData bodies (FormData sets its own boundary)
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...options, headers });
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
  authFetch: createAuthFetch,
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
    authFetch: createAuthFetch,
  }), [storeId, apiBase, storageRoots, permissions]);

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
