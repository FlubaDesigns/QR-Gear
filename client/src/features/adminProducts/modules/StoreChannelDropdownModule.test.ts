import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ProductsProvider, useProductsContext } from '../ProductsContext';
import { StoreChannelDropdownModule } from './StoreChannelDropdownModule';
const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: m.fetch }));
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn() } }));
vi.mock('@/components/ui/custom-dropdown', () => ({ CustomDropdown: (p: any) => React.createElement('dropdown', p) }));
let tree: ReactTestRenderer, value: ReturnType<typeof useProductsContext>;
const a = { id: 'a', name: 'A', roleType: 'internal', isActive: true };
const b = { id: 'b', name: 'B', roleType: 'internal', isActive: true };
const channel = { id: 'legacy', storeId: 'a', name: 'General', isActive: true };
function Probe() { value = useProductsContext(); return React.createElement(StoreChannelDropdownModule); }
const control = (id: string) => tree.root.findByProps({ 'data-testid': id });
async function settle() { await act(async () => { await new Promise(r => setTimeout(r, 10)); }); }
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(ProductsProvider, null, React.createElement(Probe)))); });
  await act(async () => { value.setSelectedStore(a as any); value.setSelectedChannel(channel); }); await settle();
}
async function change(id: string, text: string) { await act(async () => { control(id).props.onChange({ target: { value: text } }); }); }
async function click(id: string) { await act(async () => { control(id).props.onClick(); }); await settle(); }
beforeEach(() => {
  vi.clearAllMocks();
  m.fetch.mockImplementation(async (p: string, options?: any) => {
    if (options?.method) return {};
    if (p === '/fulfillment-providers') return [];
    if (p.startsWith('/stores?')) return [a,b];
    if (p.endsWith('/collections')) return { collections: ['Summer'] };
    if (p.endsWith('/channels')) return [channel];
    return [];
  });
});
afterEach(() => { if (tree) act(() => tree.unmount()); });
describe('Role/store/channel card with real context and query mutations', () => {
  it('uses the shared supported roles, including Marketplace, and filters its query by role', async () => {
    await mount(); expect(control('select-role').props.options.map((x: any) => x.value)).toEqual(['internal','external','member','marketplace']);
    await act(async () => { control('select-role').props.onChange('marketplace'); }); await settle();
    expect(m.fetch).toHaveBeenCalledWith('/stores?roleType=marketplace'); expect(value.selectedStore).toBeNull();
  });
  it('deletes the exact legacy channel path and clears its collection', async () => {
    await mount(); await act(async () => { value.setSelectedCollection({ name: 'Summer' }); }); await click('button-delete-channel');
    expect(m.fetch).toHaveBeenCalledWith('/stores/a/channels/legacy', { method: 'DELETE' }); expect(value.selectedChannel).toBeNull(); expect(value.selectedCollection).toBeNull();
  });
  it('selects a newly created store and clears the previous store channel', async () => {
    await mount(); m.fetch.mockImplementation(async (_p: string, o?: any) => o?.method === 'POST' ? b : []);
    await click('button-add-store'); await change('input-new-store','B'); await click('button-save-store');
    expect(value.selectedStore?.id).toBe('b'); expect(value.selectedChannel).toBeNull();
  });
  it.each(['store','channel','collection'])('ignores a late %s creation response after the destination changes', async kind => {
    await mount(); let resolve!: (data: any) => void;
    const original = m.fetch.getMockImplementation()!;
    m.fetch.mockImplementation((p: string, o?: any) => o?.method === 'POST' ? new Promise(y => { resolve = y; }) : original(p,o));
    await click(`button-add-${kind}`); await change(`input-new-${kind}`,'New'); await click(`button-save-${kind}`);
    await act(async () => { value.setSelectedStore(b as any); });
    await act(async () => { resolve(kind === 'store' ? { ...a, id: 'new-a' } : kind === 'channel' ? { ...channel, id: 'a--new' } : { name: 'New' }); }); await settle();
    expect(value.selectedStore?.id).toBe('b'); expect(value.selectedChannel).toBeNull(); expect(value.selectedCollection).toBeNull();
  });
  it('shows write failures and retains the selected destination', async () => {
    await mount(); m.fetch.mockRejectedValue(new Error('Could not delete channel'));
    await click('button-delete-channel'); expect(tree.root.findByProps({ role: 'alert' }).props.children).toContain('Could not delete channel'); expect(value.selectedChannel?.id).toBe('legacy');
  });
  it('shows load failures instead of a silently empty store list', async () => {
    await mount(); m.fetch.mockRejectedValue(new Error('Store list unavailable'));
    await act(async () => { value.setSelectedRole('external'); }); await settle();
    expect(tree.root.findByProps({ role: 'alert' }).props.children).toContain('Store list unavailable');
  });
  it('can clear a collection through the All products choice', async () => {
    await mount(); await act(async () => { value.setSelectedCollection({ name: 'Summer' }); });
    expect(control('select-collection').props.options[0]).toEqual({ value: '', label: 'All products' });
    await act(async () => { control('select-collection').props.onChange(''); }); expect(value.selectedCollection).toBeNull();
  });
});
