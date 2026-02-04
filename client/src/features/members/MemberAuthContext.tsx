import { createContext, useContext, useCallback, useMemo } from "react";
import { auth } from "@/lib/firebase";

export interface MemberAuthContextValue {
  requiresAuth: boolean;
  getAuthHeaders: () => Promise<HeadersInit>;
  apiBase: string;
}

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null);

interface MemberAuthProviderProps {
  children: React.ReactNode;
  apiBase?: string;
}

export function MemberAuthProvider({
  children,
  apiBase = "/api/members",
}: MemberAuthProviderProps) {
  const requiresAuth = true;

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }, []);

  const value = useMemo<MemberAuthContextValue>(
    () => ({
      requiresAuth,
      getAuthHeaders,
      apiBase,
    }),
    [requiresAuth, getAuthHeaders, apiBase]
  );

  return (
    <MemberAuthContext.Provider value={value}>
      {children}
    </MemberAuthContext.Provider>
  );
}

export function useMemberAuth(): MemberAuthContextValue {
  const context = useContext(MemberAuthContext);
  if (!context) {
    throw new Error("useMemberAuth must be used within MemberAuthProvider");
  }
  return context;
}
