import { createContext, useContext, useCallback, useMemo } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export interface AdminAuthContextValue {
  requiresAuth: boolean;
  getAuthHeaders: () => Promise<HeadersInit>;
  apiBase: string;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

interface AdminAuthProviderProps {
  children: React.ReactNode;
  apiBase?: string;
}

const waitForUser = (): Promise<unknown> =>
  new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

export function AdminAuthProvider({
  children,
  apiBase = "/api/admin",
}: AdminAuthProviderProps) {
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    let user = auth.currentUser;

    if (!user) {
      await waitForUser();
      user = auth.currentUser;
    }

    if (user) {
      const token = await user.getIdToken(true);
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      requiresAuth: true,
      getAuthHeaders,
      apiBase,
    }),
    [getAuthHeaders, apiBase]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
}
