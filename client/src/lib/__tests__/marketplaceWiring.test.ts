import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), invalidateQueries: vi.fn() }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: mocks.api, queryClient: { invalidateQueries: mocks.invalidateQueries } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/ui/switch', () => ({ Switch: (props: any) => React.createElement('button', props) }));
vi.mock('wouter', () => ({ useLocation: () => ['/', vi.fn()] }));
vi.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: any) => React.createElement('div', null, children);
  return { Dialog: ({ open, children }: any) => open ? React.createElement('div', null, children) : null, DialogContent: Pass, DialogHeader: Pass, DialogTitle: Pass, DialogFooter: Pass };
});
vi.mock('@/components/ui/select', () => {
  const Pass = ({ children, ...props }: any) => React.createElement('div', props, children);
  return { Select: Pass, SelectContent: Pass, SelectItem: Pass, SelectTrigger: Pass, SelectValue: Pass };
});
import { AccountsSection, SurfacesSection } from '@/pages/marketplaces-accounts';
import { ListingsSection, LogsSection } from '@/pages/marketplaces-listings';
let tree: ReactTestRenderer, client: QueryClient;
const flush = () => new Promise(resolve => setTimeout(resolve, 5));
async function mount(component: any, products: any = { success: true, instances: [{ id: 'built', resolved: { title: 'My saved shirt' } }], count: 1 }, records: Record<string, any> = {}) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async ({ queryKey }) => queryKey[0] === '/api/admin/catalog-instances' ? products : records[String(queryKey[0])] || [] } } });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(component))); await flush(); });
  await act(async () => { await flush(); });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('window', { location: { search: '', pathname: '/admin/marketplaces', origin: 'https://qrgear-c1ffd.web.app', assign: vi.fn() }, history: { replaceState: vi.fn() } }); });
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); vi.unstubAllGlobals(); });
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

it('offers seller signup for all three platforms before an account is created', async () => {
  await mount(AccountsSection);
  await act(async () => { tree.root.findByProps({ 'data-testid': 'button-add-account' }).props.onClick(); await flush(); });
  for (const [platform, url] of Object.entries({ amazon: 'https://sell.amazon.com/', ebay: 'https://www.ebay.com/sellercenter/selling/start-selling-on-ebay', etsy: 'https://www.etsy.com/sell' })) {
    expect(tree.root.findByProps({ 'data-testid': `link-signup-${platform}` }).props.href).toBe(url);
  }
  expect(tree.root.findAllByProps({ 'data-testid': 'input-fee-percent' })).toHaveLength(0);
});
it('connects in the same tab and includes a signup link on the account card', async () => {
  mocks.api.mockResolvedValue({ json: async () => ({ oauthUrl: 'https://auth.ebay.com/oauth2/authorize?state=test' }) });
  await mount(AccountsSection, undefined, { '/api/admin/surfaces/accounts': [{ id: 'seller', platform: 'ebay', accountName: 'Seller', isActive: true, ebayConnected: false }] });
  expect(tree.root.findByProps({ 'data-testid': 'link-marketplace-signup-seller' })).toBeDefined();
  await act(async () => { tree.root.findByProps({ 'data-testid': 'button-ebay-connect-seller' }).props.onClick(); await flush(); });
  expect(mocks.api.mock.calls[0][1]).toContain('accountId=seller&returnTo=');
  expect(window.location.assign).toHaveBeenCalledWith('https://auth.ebay.com/oauth2/authorize?state=test');
});
it('shows item fee state, provides draft Publish and retrieves fees for exactly that listing', async () => {
  mocks.api.mockResolvedValue({ json: async () => ({ fees: { status: 'estimated' } }) });
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [{ id: 'item', surfaceId: 's', accountId: 'seller', platform: 'amazon', status: 'draft', title: 'Shirt', price: 30, fees: { status: 'stale', amount: null, reason: 'Price changed' } }] });
  expect(JSON.stringify(tree.toJSON())).toContain('Fees need refreshing');
  expect(JSON.stringify(tree.toJSON())).toContain('Margin unavailable');
  expect(tree.root.findByProps({ 'data-testid': 'button-publish-item' })).toBeDefined();
  await act(async () => { tree.root.findByProps({ 'data-testid': 'button-fees-item' }).props.onClick(); await flush(); });
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/admin/surfaces/listings/item/fees', {});
});
