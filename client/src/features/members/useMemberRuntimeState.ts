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

export const MEMBER_PACKETS_QUERY_KEY = (userId: string) => ['/api/member/packets', userId];

/** One authenticated packet projection for dashboard, channels and tier progress. */
export function useMemberPackets(userId: string) {
  return useQuery<{ packets: any[] }>({
    queryKey: MEMBER_PACKETS_QUERY_KEY(userId),
    queryFn: async () => {
      await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sign in to load your products.');
      const res = await fetch(`/api/member/packets?memberId=${encodeURIComponent(userId)}`, {
        cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Could not load your products (${res.status}).`);
      const data = await res.json();
      if (!Array.isArray(data.packets)) throw new Error('The product list could not be read.');
      return data;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

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

  const { data: packets } = useMemberPackets(isAuthenticated ? userId : '');
  const publishCount = packets?.packets.filter(p => p.productionPacketId && p.status === 'published').length ?? 0;

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
