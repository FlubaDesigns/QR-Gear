import type { QueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { PROFILE_QUERY_KEY } from '@/features/members/useMemberRuntimeState';
export async function saveMemberOnboarding(userId: string, data: unknown, client: QueryClient) {
  const user = auth.currentUser;
  if (!userId || !user || user.uid !== userId) throw new Error('Sign in again before saving your profile.');
  const token = await user.getIdToken();
  if (!token) throw new Error('Sign in again before saving your profile.');
  const response = await fetch('/api/members/profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true || result?.profile?.userId !== userId || result?.profile?.isMember !== true) throw new Error(result?.error || 'Your profile could not be saved. Please retry.');
  if (auth.currentUser?.uid !== userId) throw new Error('Account changed before the profile finished saving.');
  await client.cancelQueries({ queryKey: PROFILE_QUERY_KEY(userId), exact: true });
  client.setQueryData(PROFILE_QUERY_KEY(userId), { isMember: true, profile: result.profile });
  return result.profile;
}
