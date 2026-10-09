import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ callback: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth: any, callback: any) => { m.callback = callback; return () => {}; } }));
import { useAuth } from '../hooks/useAuth';
let value: ReturnType<typeof useAuth>, tree: ReactTestRenderer, client: QueryClient;
function Probe() { value = useAuth(); return null; }
const identity = (uid: string) => ({ uid, getIdToken: async () => `token-${uid}` });
async function flush() { await act(async () => { await new Promise(r => setTimeout(r, 15)); }); }
async function mount() {
 client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(Probe))); });
}
beforeEach(() => { vi.stubGlobal('fetch', m.fetch); });
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('does not grant access from the old client bypass or hardcoded owner UID', async () => {
 vi.stubEnv('VITE_ADMIN_BYPASS','true'); m.fetch.mockRejectedValue(new Error('offline')); await mount();
 await act(async () => m.callback(identity('xHUmudG0t5OkCQhqyhB4nXhCUfs1'))); await flush();
 expect(value.isAdmin).toBe(false);
});
it('keeps admin profiles isolated when switching accounts or signing out', async () => {
 m.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'owner', isAdmin: true }) }); await mount();
 await act(async () => m.callback(identity('owner'))); await flush(); expect(value.isAdmin).toBe(true);
 let finish!: (v: any) => void; m.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
 await act(async () => m.callback(identity('visitor'))); expect(value.isAdmin).toBe(false);
 await act(async () => finish({ ok: true, json: async () => ({ id: 'owner', isAdmin: true }) })); await flush(); expect(value.isAdmin).toBe(false);
 await act(async () => m.callback(null)); expect(value.isAuthenticated).toBe(false); expect(value.isAdmin).toBe(false);
});
it('revokes cached admin UI access when account verification fails', async () => {
 m.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'owner', isAdmin: true }) }); await mount();
 await act(async () => m.callback(identity('owner'))); await flush(); expect(value.isAdmin).toBe(true);
 m.fetch.mockRejectedValue(new Error('offline'));
 await act(async () => { await client.invalidateQueries({ queryKey: ['/api/auth/user'] }); }); await flush();
 expect(value.isAdmin).toBe(false);
});
