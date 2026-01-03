import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User } from "@shared/schema";

type UserWithAdmin = User & { isAdmin?: boolean };

export function useAuth() {
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [firebaseLoading, setFirebaseLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setFirebaseLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    });
    return () => unsubscribe();
  }, [queryClient]);

  const { data: user, isLoading: apiLoading } = useQuery<UserWithAdmin>({
    queryKey: ["/api/auth/user"],
    enabled: !!firebaseUser,
    retry: false,
  });

  const isLoading = firebaseLoading || (firebaseUser && apiLoading);

  return {
    user: firebaseUser ? user : null,
    firebaseUser,
    isLoading,
    isAuthenticated: !!firebaseUser,
    isAdmin: !!user?.isAdmin,
  };
}
