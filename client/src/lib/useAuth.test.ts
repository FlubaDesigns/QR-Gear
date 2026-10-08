import { act, create } from 'react-test-renderer';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAuth } from '../hooks/useAuth';

const session = vi.hoisted(() => ({ listener: undefined as undefined | ((user: any) => void) }));
vi.mock('@/lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: any) => void) => {
    session.listener = listener;
    return () => { session.listener = undefined; };
  },
}));
let renderer: ReturnType<typeof create>;
let state: ReturnType<typeof useAuth>;
let client: QueryClient;
function Probe() { state = useAuth(); return null; }
beforeEach(() => { vi.stubEnv('VITE_ADMIN_BYPASS', 'false'); });
afterEach(() => { act(() => renderer.unmount()); client.clear(); vi.unstubAllEnvs(); });

it('waits for a restored session profile before deciding protected-page access', async () => {
  let resolveProfile!: (profile: unknown) => void;
  const profile = new Promise(resolve => { resolveProfile = resolve; });
  client = new QueryClient({ defaultOptions: { queries: { queryFn: () => profile, retry: false } } });
  act(() => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  expect(state.isLoading).toBe(true);
  await act(async () => { session.listener!({ uid: 'sandbox-owner' }); });
  expect(state.isAuthenticated).toBe(true);
  expect(state.isLoading).toBe(true);
  expect(state.user).toBeUndefined();
  await act(async () => {
    resolveProfile({ id: 'sandbox-owner', isAdmin: true });
    await profile;
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(state.isLoading).toBe(false);
  expect(state.isAdmin).toBe(true);
});

it('finishes checking signed-out sessions without requesting an account profile', async () => {
  const queryFn = vi.fn();
  client = new QueryClient({ defaultOptions: { queries: { queryFn, retry: false } } });
  act(() => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await act(async () => { session.listener!(null); });
  expect(state.isLoading).toBe(false);
  expect(state.isAuthenticated).toBe(false);
  expect(state.isAdmin).toBe(false);
  expect(queryFn).not.toHaveBeenCalled();
});

it('does not grant admin status to an ordinary authenticated profile', async () => {
  client = new QueryClient({ defaultOptions: { queries: { queryFn: async () => ({ id: 'member', isAdmin: false }), retry: false } } });
  act(() => { renderer = create(createElement(QueryClientProvider, { client }, createElement(Probe))); });
  await act(async () => { session.listener!({ uid: 'member' }); await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(state.isAuthenticated).toBe(true);
  expect(state.isLoading).toBe(false);
  expect(state.isAdmin).toBe(false);
});
