import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";

export interface MemberRuntimeState {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string;
  onboardingComplete: boolean;
  publishCount: number;
  profileError: boolean;
  unlockedTiers: {
    simple: boolean;
    advanced: boolean;
    studio: boolean;
  };
  refreshProfile: () => void;
}

const PROFILE_QUERY_KEY = (userId: string) => ['/api/members/profile', userId];
const PROFILE_STALE_MS = 2 * 60 * 1000;

export { PROFILE_QUERY_KEY };

export function useMemberRuntimeState(): MemberRuntimeState {
  const { user: apiUser, firebaseUser, isLoading: authLoading, isAuthenticated } = useAuth();
  const userId = apiUser?.id || firebaseUser?.uid || '';
  const qc = useQueryClient();

  const {
    data: profileData,
    isLoading: profileLoading,
    isError: profileIsError,
  } = useQuery({
    queryKey: PROFILE_QUERY_KEY(userId),
    queryFn: async () => {
      if (!userId) return null;
      const token = await auth.currentUser?.getIdToken();
      if (!token) return null;
      const res = await fetch('/api/members/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Profile fetch failed (${res.status})`);
      }
      return res.json() as Promise<{ isMember: boolean; profile?: { publishCount?: number } } | null>;
    },
    enabled: !!userId && isAuthenticated,
    staleTime: PROFILE_STALE_MS,
    retry: 2,
  });

  const onboardingComplete = profileData?.isMember === true;

  const serverCount = profileData?.profile?.publishCount ?? 0;
  const localCount = userId
    ? parseInt(localStorage.getItem(`publish_count_${userId}`) || '0', 10)
    : 0;
  const publishCount = Math.max(serverCount, localCount);

  return {
    isLoading: authLoading || (!!userId && isAuthenticated && profileLoading),
    isAuthenticated,
    userId,
    onboardingComplete,
    publishCount,
    profileError: isAuthenticated && !!userId && profileIsError,
    unlockedTiers: {
      simple: true,
      advanced: publishCount >= 1,
      studio: publishCount >= 2,
    },
    refreshProfile: () => qc.invalidateQueries({ queryKey: PROFILE_QUERY_KEY(userId) }),
  };
}
