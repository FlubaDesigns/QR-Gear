import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User } from "@shared/schema";

type UserWithAdmin = User & { isAdmin?: boolean };

export function useAuth() {
  const queryClient = useQueryClient();
  // Start as undefined to distinguish "not yet checked" from "checked and no user"
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthChecked(true);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    });
    return () => unsubscribe();
  }, [queryClient]);

  const { data: user, isLoading: apiLoading, isError: profileError, error, refetch } = useQuery<UserWithAdmin | null>({
    queryKey: ["/api/auth/user", firebaseUser?.uid],
    queryFn: async ({ signal }) => {
      if (!firebaseUser) return null;
      const token = await firebaseUser.getIdToken();
      // Establish owner-only image/video access before protected pages render.
      // Native <img>, canvas, video and download requests cannot set Bearer headers.
      const fileSession = await fetch('/api/auth/member-file-session', {
        method: 'POST', signal, headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (!fileSession.ok) throw new Error('Could not enable access to your private uploads. Refresh and try again.');
      const response = await fetch('/api/auth/user', { signal, headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Could not verify account access.');
      const profile = await response.json();
      return profile?.id === firebaseUser.uid ? profile : null;
    },
    enabled: !!firebaseUser,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 60 * 1000,
    refetchIntervalInBackground: true,
    retry: false,
  });

  // A restored Firebase session can precede its application profile. Keep
  // protected pages loading until that profile (including admin status) resolves.
  const isLoading = !authChecked || (!!firebaseUser && apiLoading);

  // The server is authoritative; a cached profile can never grant another identity access.
  const isAdmin = !profileError && !!firebaseUser && user?.id === firebaseUser.uid && user?.isAdmin === true;

  return {
    user: firebaseUser ? user : null,
    firebaseUser,
    isLoading,
    isAuthenticated: !!firebaseUser,
    isAdmin,
    error: firebaseUser ? error : null,
    retry: refetch,
  };
}
