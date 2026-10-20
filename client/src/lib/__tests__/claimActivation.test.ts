import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ params: {} as any, search: '', navigate: vi.fn(), api: vi.fn() }));
vi.mock('wouter', () => ({ useParams: () => m.params, useSearch: () => m.search, useLocation: () => ['/', m.navigate] }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner', email: 'owner@example.test' }, isLoading: false }) }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: m.api }));
import ClaimPage from '@/pages/claim';
let tree: ReactTestRenderer, client: QueryClient;
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); };
async function mount() {
 client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(ClaimPage))); });
 await settle();
}
beforeEach(() => {
 vi.clearAllMocks(); m.params = {}; m.search = 'instanceId=unit';
 vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ valid: true, claimData: { productName: 'My Shirt', packetType: 'qr_canvas' } }) })));
 m.api.mockResolvedValue({ json: async () => ({ success: true, instanceId: 'unit', hostingExpiresAt: '2030-12-01T12:00:00Z', status: 'active' }) });
});
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); vi.unstubAllGlobals(); });
it('first scan requests a code and keeps the scanned item bound when continuing', async () => {
 await mount();
 expect(m.api).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
 await act(async () => { tree.root.findByType('input').props.onChange({ target: { value: ' MYCODE ' } }); });
 await act(async () => { tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() }); });
 expect(m.navigate).toHaveBeenCalledWith('/claim/MYCODE?instanceId=unit');
});
it('activates explicitly and displays the saved server expiration rather than inventing a date', async () => {
 m.params = { claimCode: 'MYCODE' }; await mount();
 expect(fetch).toHaveBeenCalledWith('/api/claim/validate/MYCODE?instanceId=unit', expect.anything());
 expect(m.api).not.toHaveBeenCalled();
 await act(async () => tree.root.findAllByType('button').find(b => b.props['data-testid'] === 'btn-continue')!.props.onClick());
 await act(async () => tree.root.findAllByType('button').find(b => b.props['data-testid'] === 'btn-activate')!.props.onClick()); await settle();
 expect(m.api).toHaveBeenCalledWith('POST', '/api/claim/MYCODE', { instanceId: 'unit' });
 expect(JSON.stringify(tree.toJSON())).toContain('2030');
});
