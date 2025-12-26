import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

type UserWithAdmin = User & { isAdmin?: boolean };

export function useAuth() {
  const { data: user, isLoading } = useQuery<UserWithAdmin>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: !!user?.isAdmin,
  };
}
