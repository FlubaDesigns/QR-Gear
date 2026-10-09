import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ProductsControlBar } from './ProductsControlBar';
const m = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn(), invalidate: vi.fn(), context: {} as any }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: m.fetch }));
vi.mock('../ProductsContext', () => ({ useProductsContext: () => m.context }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock('@/components/ui/radio-group', () => ({ RadioGroup: (p: any) => React.createElement('radio-group', p), RadioGroupItem: (p: any) => React.createElement('radio-item', p) }));
vi.mock('@/components/ui/label', () => ({ Label: (p: any) => React.createElement('label', p) }));
vi.mock('@/components/ui/button', () => ({ Button: (p: any) => React.createElement('button', p) }));
vi.mock('@/components/ui/badge', () => ({ Badge: (p: any) => React.createElement('badge', p) }));
let tree: ReactTestRenderer;
const completed = { status: 'completed', completedAt: '2026-10-07T00:00:00Z', summary: { products: { added: 2, updated: 1, skipped: 4, total: 7 } } };
const button = () => tree.root.findByProps({ 'data-testid': 'button-sync-catalog' });
function deferred() { let resolve!: (x?: any) => void; let reject!: (e: Error) => void; const promise = new Promise((y, n) => { resolve = y; reject = n; }); return { resolve, reject, promise }; }
async function mount() { await act(async () => { tree = create(React.createElement(ProductsControlBar)); }); }
async function click() { await act(async () => { await button().props.onClick(); }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  m.context = { api: { invalidateProducts: m.invalidate }, providers: ['printify', 'printful'].map(id => ({ id, name: id, role: 'fulfillment', configured: true })), selectedProviders: ['printful'], setSelectedProviders: vi.fn(), preferredProvider: null, saveProviderPreference: vi.fn().mockResolvedValue({}), reloadProviderPreference: vi.fn(), providersLoading: false, providersError: null };
  m.fetch.mockImplementation(async (path: string) => path.includes('sync-status?provider=') ? completed : path.includes('sync-status?syncId=') ? completed : path === '/sync-master-products' ? { success: true } : { syncId: 'job' });
  m.invalidate.mockResolvedValue(undefined);
});
afterEach(() => { if (tree) act(() => tree.unmount()); vi.useRealTimers(); });
describe('Fulfillment card sync lifecycle', () => {
  it('uses the existing selection when saving the new-build preference', async () => {
    await mount();
    await act(async () => { await tree.root.findByProps({ 'data-testid': 'button-save-provider-preference' }).props.onClick(); });
    expect(m.context.saveProviderPreference).toHaveBeenCalledWith('printful');
    expect(tree.root.findAllByProps({ 'data-testid': 'radio-fulfillment' }).length).toBeGreaterThan(0);
  });
  it('does not silently select Printify or request its history when no preference is saved', async () => {
    m.context.selectedProviders = []; await mount();
    expect(m.fetch).not.toHaveBeenCalled(); expect(button().props.disabled).toBe(true);
  });
  it('reads history without rebuilding, invalidating or announcing success on mount', async () => {
    await mount(); expect(m.fetch.mock.calls).toEqual([['/catalog/sync-status?provider=printful']]); expect(m.invalidate).not.toHaveBeenCalled(); expect(m.toast).not.toHaveBeenCalled();
  });
  it.each(['printify', 'printful'])('syncs the selected %s supplier then rebuilds QRG', async provider => {
    m.context.selectedProviders = [provider]; await mount(); await click();
    expect(m.fetch).toHaveBeenCalledWith(provider === 'printful' ? '/catalog/sync-printful' : '/catalog/sync', { method: 'POST', json: { provider } });
    expect(m.fetch).toHaveBeenCalledWith('/sync-master-products', { method: 'POST' }); expect(m.invalidate).toHaveBeenCalledTimes(1);
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Smart Sync Complete', description: expect.stringContaining('2 new, 1 updated, 4 unchanged') }));
  });
  it('awaits QRG rebuild and catalog refresh before success; double clicks cannot start another job', async () => {
    const rebuild = deferred(), refresh = deferred();
    m.fetch.mockImplementation(async (path: string) => path.includes('provider=') ? completed : path.includes('syncId=') ? completed : path === '/sync-master-products' ? rebuild.promise : { syncId: 'job' });
    m.invalidate.mockReturnValue(refresh.promise);
    await mount(); let running!: Promise<void>;
    await act(async () => { running = button().props.onClick(); });
    expect(button().props.disabled).toBe(true); expect(m.toast).not.toHaveBeenCalled(); expect(m.invalidate).not.toHaveBeenCalled();
    await click(); expect(m.fetch.mock.calls.filter(([p]) => p === '/catalog/sync-printful')).toHaveLength(1);
    await act(async () => { rebuild.resolve(); }); expect(m.invalidate).toHaveBeenCalledTimes(1); expect(m.toast).not.toHaveBeenCalled();
    await act(async () => { refresh.resolve(); await running; }); expect(m.toast).toHaveBeenCalledTimes(1);
  });
  it.each(['poll', 'rebuild', 'supplier', 'missing-id'])('surfaces %s failure without a success toast', async failure => {
    m.fetch.mockImplementation(async (path: string) => {
      if (path.includes('provider=')) return completed;
      if (failure === 'missing-id') return {};
      if (path.includes('syncId=')) { if (failure === 'poll') throw new Error('Status unavailable'); return failure === 'supplier' ? { status: 'failed', errorMessage: 'Supplier failed' } : completed; }
      if (path === '/sync-master-products') throw new Error('QRG rebuild failed');
      return { syncId: 'job' };
    });
    await mount(); await click(); expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })); expect(m.invalidate).not.toHaveBeenCalled();
    expect(m.toast.mock.calls.some(([n]) => n.title === 'Smart Sync Complete')).toBe(false);
  });
  it('surfaces a catalog refresh failure after rebuilding', async () => {
    m.invalidate.mockRejectedValue(new Error('Catalog refresh failed'));
    await mount(); await click();
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'Catalog refresh failed' }));
    expect(m.toast.mock.calls.some(([n]) => n.title === 'Smart Sync Complete')).toBe(false);
  });
  it('does not let a late history response overwrite a running sync', async () => {
    const history = deferred();
    m.fetch.mockImplementation(async (p: string) => p.includes('provider=') ? history.promise : p.includes('syncId=') ? { status: 'running' } : { syncId: 'job' });
    await mount(); await click(); await act(async () => { history.resolve(completed); });
    expect(JSON.stringify(tree.toJSON())).toContain('Comparing with Firestore');
    expect(JSON.stringify(tree.toJSON())).not.toContain('Last supplier sync:');
    expect(m.toast).not.toHaveBeenCalled();
  });
  it('does not overlap slow polls or rebuild twice', async () => {
    const poll = deferred(); let reads = 0;
    m.fetch.mockImplementation(async (p: string) => p.includes('provider=') ? completed : p.includes('syncId=') ? (++reads === 1 ? { status: 'running' } : poll.promise) : p === '/sync-master-products' ? {} : { syncId: 'job' });
    await mount(); await click();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); }); expect(reads).toBe(2);
    await act(async () => { poll.resolve(completed); });
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); }); expect(m.fetch.mock.calls.filter(([p]) => p === '/sync-master-products')).toHaveLength(1);
  });
  it('does not rebuild if unmounted during a supplier poll', async () => {
    const poll = deferred(); m.fetch.mockImplementation(async (p: string) => p.includes('provider=') ? completed : p.includes('syncId=') ? poll.promise : { syncId: 'job' });
    await mount(); let running!: Promise<void>; await act(async () => { running = button().props.onClick(); });
    act(() => tree.unmount()); await act(async () => { poll.resolve(completed); await running; });
    expect(m.fetch.mock.calls.some(([p]) => p === '/sync-master-products')).toBe(false);
  });
  it('shows unknown configuration and blocks sync when provider status fails', async () => {
    m.context.providersError = 'Configuration unavailable'; m.context.providers = m.context.providers.map((p: any) => ({ ...p, configured: false })); await mount();
    expect(button().props.disabled).toBe(true); await click(); expect(m.fetch.mock.calls.filter(([,o]) => o?.method === 'POST')).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Unknown'); expect(JSON.stringify(tree.toJSON())).toContain('Configuration unavailable');
  });
});

it('resumes saved progress through awaited server steps and refreshes without a second QRG rebuild', async () => {
 const progress = {syncId:'saved',status:'running',resumable:true,processed:4,total:5};
 m.fetch.mockImplementation(async (_path:string, options:any) => options?.json?.syncId ? {...completed,resumable:true} : progress);
 await mount(); expect(JSON.stringify(tree.toJSON())).toContain('Resume Sync');
 expect(m.fetch.mock.calls.filter(([,o])=>o?.method==='POST')).toHaveLength(0);
 await click();
 expect(m.fetch).toHaveBeenCalledWith('/catalog/sync-printful',{method:'POST',json:{syncId:'saved'}});
 expect(m.fetch.mock.calls.some(([p])=>p==='/sync-master-products')).toBe(false);
 expect(m.invalidate).toHaveBeenCalledTimes(1);
});
