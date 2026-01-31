import { createContext, useContext, useCallback, useMemo } from "react";
import { auth } from "@/lib/firebase";

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

export function AdminAuthProvider({
  children,
  apiBase = "/api",
}: AdminAuthProviderProps) {
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

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      requiresAuth,
      getAuthHeaders,
      apiBase,
    }),
    [requiresAuth, getAuthHeaders, apiBase]
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
