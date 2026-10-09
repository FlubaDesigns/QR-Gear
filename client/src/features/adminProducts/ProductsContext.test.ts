import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductsProvider, useProductsContext } from './ProductsContext';
const m = vi.hoisted(() => ({ fetch: vi.fn(), invalidate: vi.fn().mockResolvedValue(undefined), setQueryData: vi.fn() }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: m.fetch }));
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: m.invalidate, setQueryData: m.setQueryData } }));
let value: ReturnType<typeof useProductsContext>;
let tree: ReactTestRenderer;
function Probe() { value = useProductsContext(); return null; }
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(ProductsProvider, null, React.createElement(Probe)))); });
}
afterEach(() => { if (tree) act(() => tree.unmount()); vi.clearAllMocks(); });
describe('Fulfillment provider configuration and refresh', () => {
  it('does not claim configuration while loading or after an API failure', async () => {
    let reject!: (e: Error) => void;
    m.fetch.mockImplementation((path: string) => path === '/fulfillment-providers' ? new Promise((_, n) => { reject = n; }) : Promise.resolve([]));
    await mount(); expect(value.providersLoading).toBe(true); expect(value.providers.every(p => !p.configured)).toBe(true);
    await act(async () => { reject(new Error('Cannot check configuration')); });
    await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(value.providersError).toBe('Cannot check configuration'); expect(value.providers.every(p => !p.configured)).toBe(true);
  });
  it('uses actual configuration and refreshes the query consumed by the QRG picker', async () => {
    m.fetch.mockImplementation(async (path: string) => path === '/fulfillment-providers' ? [{ id: 'printify', name: 'Printify', role: 'fulfillment', configured: true }, { id: 'printful', name: 'Printful', role: 'fulfillment', configured: true }] : []);
    await mount(); await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(value.providers.every(p => p.configured)).toBe(true);
    await value.api.invalidateProducts();
    expect(m.invalidate).toHaveBeenCalledWith({ queryKey: ['/api/master-catalog'] }, { throwOnError: true });
    expect(m.invalidate).toHaveBeenCalledWith({ queryKey: ['joint-catalog-products'] }, { throwOnError: true });
    expect(m.invalidate).toHaveBeenCalledWith({ queryKey: ['products'] });
  });
});

describe('Destination selection blast radius', () => {
  const store = { id: 'a', name: 'Store A', roleType: 'internal' as const, isActive: true };
  const channel = { id: 'legacy-channel', name: 'General', storeId: 'a', isActive: true };
  async function selectDestination() {
    await act(async () => { value.setSelectedRole('internal'); value.setSelectedStore(store); value.setSelectedChannel(channel); value.setSelectedCollection({ name: 'Summer' }); });
  }
  it('clears child selections on role/store changes for every caller', async () => {
    m.fetch.mockResolvedValue([]); await mount(); await selectDestination();
    expect(value.selectedCollection?.name).toBe('Summer');
    await act(async () => { value.setSelectedStore({ ...store, id: 'b' }); });
    expect(value.selectedChannel).toBeNull(); expect(value.selectedCollection).toBeNull();
    await selectDestination(); await act(async () => { value.setSelectedRole('external'); });
    expect(value.selectedStore).toBeNull(); expect(value.selectedChannel).toBeNull(); expect(value.selectedCollection).toBeNull();
  });
  it('restores role/store/channel/collection together, preserving legacy IDs and unrelated fulfillment choice', async () => {
    m.fetch.mockResolvedValue([]); await mount(); await selectDestination();
    expect(value.selectedStore).toEqual(store); expect(value.selectedChannel).toEqual(channel); expect(value.selectedCollection?.name).toBe('Summer');
    expect(value.selectedProviders).toEqual([]);
  });
  it('rejects a mismatched channel during draft restoration without retaining a collection', async () => {
    m.fetch.mockResolvedValue([]); await mount();
    await act(async () => { value.setSelectedStore(store); value.setSelectedChannel({ ...channel, storeId: 'other' }); value.setSelectedCollection({ name: 'Old' }); });
    expect(value.selectedChannel).toBeNull(); expect(value.selectedCollection).toBeNull(); expect(value.destinationError).toContain('does not belong');
  });
  it('does not let late default loading overwrite restored destination metadata', async () => {
    let resolve!: (data: any) => void;
    m.fetch.mockImplementation((path: string) => path.startsWith('/stores?') ? new Promise(y => { resolve = y; }) : Promise.resolve([]));
    await mount(); await selectDestination();
    await act(async () => { resolve([{ ...store, id: 'qr-gear', name: 'QR Gear' }]); });
    expect(value.selectedStore?.id).toBe('a'); expect(value.selectedChannel?.id).toBe('legacy-channel');
  });
  it('surfaces missing routes instead of converting their 404 errors into empty lists', async () => {
    m.fetch.mockResolvedValue([]); await mount(); m.fetch.mockRejectedValue(new Error('404 missing route'));
    await expect(value.api.fetchStores('internal')).rejects.toThrow('404');
    await expect(value.api.fetchChannels('a')).rejects.toThrow('404');
    await expect(value.api.fetchCollections('a', 'c')).rejects.toThrow('404');
  });
});

describe('Existing fulfillment selector preference', () => {
  it('loads the saved provider instead of an invented default', async () => {
    m.fetch.mockImplementation(async path => path === '/settings' ? { defaultFulfillmentProvider: 'printify' } : []);
    await mount(); await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    expect(value.selectedProviders).toEqual(['printify']);
  });
  it('does not overwrite a restored build with a late preference response or save restoration as a default', async () => {
    let resolve!: (data: any) => void;
    m.fetch.mockImplementation(path => path === '/settings' ? new Promise(r => { resolve = r; }) : Promise.resolve([]));
    await mount(); await act(async () => { value.setSelectedProviders(['printful']); });
    await act(async () => { resolve({ defaultFulfillmentProvider: 'printify' }); await new Promise(r => setTimeout(r, 10)); });
    expect(value.selectedProviders).toEqual(['printful']); expect(m.fetch.mock.calls.some(([, o]) => o?.method === 'PUT')).toBe(false);
  });
  it('saves only the explicit preference and reports a failed save', async () => {
    m.fetch.mockResolvedValue([]); await mount();
    m.fetch.mockResolvedValue({ defaultFulfillmentProvider: 'printful' });
    await act(async () => { await value.saveProviderPreference('printful'); });
    expect(m.fetch).toHaveBeenCalledWith('/settings', { method: 'PUT', json: { defaultFulfillmentProvider: 'printful' } });
    m.fetch.mockRejectedValue(new Error('Settings write failed'));
    await act(async () => { await expect(value.saveProviderPreference('printify')).rejects.toThrow('Settings write failed'); await new Promise(r => setTimeout(r, 10)); });
    expect(value.providerPreferenceError).toBe('Settings write failed');
  });
});
