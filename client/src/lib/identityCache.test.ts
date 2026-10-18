import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { privateQueryKey, resetIdentityCache } from './identityCache';
const m = vi.hoisted(() => ({ auth: { currentUser: null as any, authStateReady: async () => {} }, listener: null as any }));
vi.mock('@/lib/firebase', () => ({ auth: m.auth }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_: any, fn: any) => { m.listener = fn; return () => {}; } }));
vi.mock('@/lib/nexus', () => ({ Nexus: { retry: (fn: any) => fn() } }));
import { getQueryFn } from './queryClient';
import { AuthIdentityBoundary } from '../components/AuthIdentityBoundary';
let tree: ReactTestRenderer; const clients: QueryClient[] = [];
const client = () => { const c = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } }); clients.push(c); return c; };
afterEach(() => { act(() => tree?.unmount()); clients.forEach(c => c.clear()); m.auth.currentUser = null; vi.unstubAllGlobals(); });
it('removes prior private data and prevents a delayed previous-account result from restoring it', async () => {
  const c = client(); resetIdentityCache(c, 'A'); c.setQueryData(privateQueryKey('/api/orders', 'A'), ['A-secret']);
  let resolve!: (v: string[]) => void;
  const pending = c.fetchQuery({ queryKey: ['/api/cart'], queryFn: () => new Promise<string[]>(r => { resolve = r; }) }).catch(() => null);
  resetIdentityCache(c, 'B'); resolve(['A-cart']); await pending;
  expect(c.getQueryData(privateQueryKey('/api/orders', 'A'))).toBeUndefined(); expect(c.getQueryData(['/api/cart'])).toBeUndefined();
  const fetchB = vi.fn(async () => ['B-orders']); expect(await c.fetchQuery({ queryKey: privateQueryKey('/api/orders', 'B'), queryFn: fetchB })).toEqual(['B-orders']); expect(fetchB).toHaveBeenCalledTimes(1);
});
it('keeps UID metadata out of URLs and rejects old-identity async query results', async () => {
  m.auth.currentUser = { uid: 'A', getIdToken: async () => 'A-token' };
  const fn = getQueryFn({ on401: 'throw' });
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => ['A-orders'] })); vi.stubGlobal('fetch', fetchMock);
  expect(await fn({ queryKey: privateQueryKey('/api/orders', 'A'), signal: new AbortController().signal } as any)).toEqual(['A-orders']); expect(fetchMock.mock.calls[0][0]).toBe('/api/orders');
  fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => { m.auth.currentUser = { uid: 'B' }; return ['A-orders']; } }));
  await expect(fn({ queryKey: privateQueryKey('/api/orders', 'A'), signal: new AbortController().signal } as any)).rejects.toThrow('Account changed');
});
it('discards account component state on an identity switch while preserving a guest draft at sign-in', async () => {
  function Draft() { const [value, setValue] = useState('empty'); return React.createElement('input', { value, onChange: (v: string) => setValue(v) }); }
  act(() => { tree = create(React.createElement(QueryClientProvider, { client: client() }, React.createElement(AuthIdentityBoundary, { children: React.createElement(Draft) }))); });
  act(() => m.listener(null)); act(() => tree.root.findByType('input').props.onChange('guest draft'));
  act(() => m.listener({ uid: 'A' })); expect(tree.root.findByType('input').props.value).toBe('guest draft');
  act(() => tree.root.findByType('input').props.onChange('A private draft'));
  act(() => m.listener({ uid: 'B' })); expect(tree.root.findByType('input').props.value).toBe('empty');
});
