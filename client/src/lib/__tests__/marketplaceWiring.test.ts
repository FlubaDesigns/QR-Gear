import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), invalidateQueries: vi.fn() }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: mocks.api, queryClient: { invalidateQueries: mocks.invalidateQueries } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('wouter', () => ({ useLocation: () => ['/', vi.fn()] }));
vi.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: any) => React.createElement('div', null, children);
  return { Dialog: ({ open, children }: any) => open ? React.createElement('div', null, children) : null, DialogContent: Pass, DialogHeader: Pass, DialogTitle: Pass, DialogFooter: Pass };
});
vi.mock('@/components/ui/select', () => {
  const Pass = ({ children, ...props }: any) => React.createElement('div', props, children);
  return { Select: Pass, SelectContent: Pass, SelectItem: Pass, SelectTrigger: Pass, SelectValue: Pass };
});
import { SurfacesSection } from '@/pages/marketplaces-accounts';
import { LogsSection } from '@/pages/marketplaces-listings';
let tree: ReactTestRenderer, client: QueryClient;
const flush = () => new Promise(resolve => setTimeout(resolve, 5));
async function mount(component: any, products: any = { success: true, instances: [{ id: 'built', resolved: { title: 'My saved shirt' } }], count: 1 }) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async ({ queryKey }) => queryKey[0] === '/api/admin/catalog-instances' ? products : [] } } });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(component))); await flush(); });
  await act(async () => { await flush(); });
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); });
it('renders products from the canonical response envelope', async () => {
  await mount(SurfacesSection);
  await act(async () => { tree.root.findByProps({ 'data-testid': 'button-generate-surface' }).props.onClick(); await flush(); });
  await act(async () => { await flush(); });
  expect(JSON.stringify(tree.toJSON())).toContain('My saved shirt');
  expect(tree.root.findByProps({ 'data-testid': 'option-instance-built' })).toBeDefined();
});
it('shows malformed product responses as errors instead of crashing or showing an empty picker', async () => {
  await mount(SurfacesSection, []);
  await act(async () => { tree.root.findByProps({ 'data-testid': 'button-generate-surface' }).props.onClick(); await flush(); });
  await act(async () => { await flush(); });
  expect(JSON.stringify(tree.toJSON())).toContain('Invalid product response');
});
it('loads Logs through the authenticated request helper and shows read failure', async () => {
  mocks.api.mockRejectedValue(new Error('Authentication expired'));
  await mount(LogsSection);
  expect(mocks.api).toHaveBeenCalledWith('GET', '/api/admin/surfaces/logs');
  expect(JSON.stringify(tree.toJSON())).toContain('Could not load logs');
  expect(tree.root.findAllByProps({ 'data-testid': 'text-empty-logs' })).toHaveLength(0);
});
