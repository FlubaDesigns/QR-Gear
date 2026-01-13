import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User } from "@shared/schema";

type UserWithAdmin = User & { isAdmin?: boolean };

// Hardcoded admin UIDs for immediate client-side check (fallback if API is slow/fails)
const ADMIN_UIDS = ["xHUmudG0t5OkCQhqyhB4nXhCUfs1"];

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

  const { data: user, isLoading: apiLoading } = useQuery<UserWithAdmin>({
    queryKey: ["/api/auth/user"],
    enabled: !!firebaseUser,
    retry: false,
  });

  // Still loading if auth hasn't been checked OR if we have a user and API is still loading
  const isLoading = !authChecked || (firebaseUser && apiLoading);

  // Check admin from API response OR fallback to hardcoded UID check
  // The hardcoded check works immediately once firebaseUser is available
  const isAdmin = !!user?.isAdmin || (firebaseUser ? ADMIN_UIDS.includes(firebaseUser.uid) : false);

  return {
    user: firebaseUser ? user : null,
    firebaseUser,
    isLoading,
    isAuthenticated: !!firebaseUser,
    isAdmin,
  };
}
