import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductsProvider, useProductsContext } from './ProductsContext';
const m = vi.hoisted(() => ({ fetch: vi.fn(), invalidate: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: m.fetch }));
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: m.invalidate } }));
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
    expect(m.invalidate).toHaveBeenCalledWith({ queryKey: ['products'] });
  });
});
