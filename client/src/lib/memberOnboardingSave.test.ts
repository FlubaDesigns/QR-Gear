import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: { currentUser: null as any } }));
vi.mock('@/lib/firebase', () => ({ auth: m.auth }));
import { saveMemberOnboarding } from './memberOnboardingSave';
import { PROFILE_QUERY_KEY } from '@/features/members/useMemberRuntimeState';
afterEach(() => vi.unstubAllGlobals());
it('replaces a fresh cached non-member profile only after acknowledged save', async () => {
 const client = new QueryClient(); client.setQueryData(PROFILE_QUERY_KEY('buyer'), { isMember: false });
 const observer = new QueryObserver(client, { queryKey: PROFILE_QUERY_KEY('buyer'), staleTime: 120000 }); const unsubscribe = observer.subscribe(() => {});
 m.auth.currentUser = { uid: 'buyer', getIdToken: async () => 'token' };
 vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, profile: { userId: 'buyer', isMember: true } }) })));
 await saveMemberOnboarding('buyer', {}, client); expect(observer.getCurrentResult().data).toMatchObject({ isMember: true }); unsubscribe(); client.clear();
});
it('rejects failed, missing-token and identity-changing saves without marking completion', async () => {
 const client = new QueryClient(); client.setQueryData(PROFILE_QUERY_KEY('buyer'), { isMember: false });
 m.auth.currentUser = { uid: 'buyer', getIdToken: async () => 'token' };
 vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'server failed' }) })));
 await expect(saveMemberOnboarding('buyer', {}, client)).rejects.toThrow('server failed');
 m.auth.currentUser = null; await expect(saveMemberOnboarding('buyer', {}, client)).rejects.toThrow('Sign in');
 expect(client.getQueryData(PROFILE_QUERY_KEY('buyer'))).toEqual({ isMember: false }); client.clear();
});
