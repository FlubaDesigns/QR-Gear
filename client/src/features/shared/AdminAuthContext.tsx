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
  apiBase = "/api/admin",
}: AdminAuthProviderProps) {
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
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
