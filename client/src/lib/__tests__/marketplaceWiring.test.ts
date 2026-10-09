import {EtsySetupDialog} from '@/pages/marketplaces-etsy';
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
import { AccountsSection } from '@/pages/marketplaces-accounts';
import { ListingsSection, ActivitySection } from '@/pages/marketplaces-listings';
vi.mock('@/components/AdminShell', () => ({ default: ({ tabs, onTabChange, children }: any) => React.createElement('div', null, tabs.map((tab: any) => React.createElement('button', { key: tab.id, 'data-testid': `tab-${tab.id}`, onClick: () => onTabChange(tab.id) }, tab.label)), children) }));
vi.mock('@/components/admin/AdminSectionSubNav', () => ({ default: () => null }));
import AdminMarketplaces from '@/pages/admin-marketplaces';
let tree: ReactTestRenderer, client: QueryClient;
const flush = () => new Promise(resolve => setTimeout(resolve, 5));
async function mount(component: any, products: any = { success: true, instances: [{ id: 'built', resolved: { title: 'My saved shirt' } }], count: 1 }, records: Record<string, any> = {}) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async ({ queryKey }) => queryKey[0] === '/api/admin/catalog-instances' ? products : records[String(queryKey[0])] || [] } } });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(component))); await flush(); });
  await act(async () => { await flush(); });
}
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('window', { location: { search: '', pathname: '/admin/marketplaces', origin: 'https://qrgear-c1ffd.web.app', assign: vi.fn() }, history: { replaceState: vi.fn() }, confirm: vi.fn(() => true) }); });
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); vi.unstubAllGlobals(); });
it('renders products from the canonical response envelope', async () => {
  await mount(ListingsSection);
  await act(async () => { tree.root.findByProps({ 'data-testid': 'button-generate-surface' }).props.onClick(); await flush(); });
  await act(async () => { await flush(); });
  expect(JSON.stringify(tree.toJSON())).toContain('My saved shirt');
  expect(tree.root.findByProps({ 'data-testid': 'option-instance-built' })).toBeDefined();
});
it('shows malformed product responses as errors instead of crashing or showing an empty picker', async () => {
  await mount(ListingsSection, []);
  await act(async () => { tree.root.findByProps({ 'data-testid': 'button-generate-surface' }).props.onClick(); await flush(); });
  await act(async () => { await flush(); });
  expect(JSON.stringify(tree.toJSON())).toContain('Invalid product response');
});
it('loads Logs through the authenticated request helper and shows read failure', async () => {
  mocks.api.mockRejectedValue(new Error('Authentication expired'));
  await mount(ActivitySection);
  expect(mocks.api).not.toHaveBeenCalled();
  await click("button-activity-details");
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

async function click(id: string) {
  await act(async () => { tree.root.findByProps({ 'data-testid': id }).props.onClick(); await flush(); });
  await act(async () => { await flush(); });
}
async function select(id: string, value: string) {
  let node = tree.root.findByProps({ 'data-testid': id });
  while (!node.props.onValueChange) node = node.parent!;
  await act(async () => { node.props.onValueChange(value); await flush(); });
}
const surface = { id: 's', masterProductId: 'built', title: 'Shirt', retailPrice: 30, sku: 'SKU', enabledPlatforms: ['amazon'] };
const listing = { id: 'item', surfaceId: 's', accountId: 'seller', platform: 'amazon', status: 'draft', title: 'Shirt', price: 30 };
it('offers exactly Accounts, Listings and Activity with the product action inside Listings', async () => {
  await mount(AdminMarketplaces);
  expect(tree.root.findAll(node => node.type === 'button' && node.props['data-testid']?.startsWith('tab-')).map(node => node.children.join(''))).toEqual(['Accounts', 'Listings', 'Activity']);
  await click('tab-listings');
  expect(tree.root.findByProps({ 'data-testid': 'button-generate-surface' })).toBeDefined();
  await click('tab-activity');
  expect(tree.root.findByProps({ 'data-testid': 'text-jobs-title' })).toBeDefined();
  expect(tree.root.findAllByProps({ 'data-testid': 'text-logs-title' })).toHaveLength(0);
});
it('loads and saves the listing’s existing item setup and refreshes item fees', async () => {
  mocks.api.mockImplementation(async (method: string) => ({ json: async () => method === 'GET' ? surface : { success: true } }));
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [listing], '/api/admin/surfaces': [surface] });
  await click('button-setup-item');
  expect(mocks.api).toHaveBeenCalledWith('GET', '/api/admin/surfaces/s');
  await act(async () => { tree.root.findByProps({ 'data-testid': 'input-surface-title' }).props.onChange({ target: { value: 'Updated shirt' } }); });
  await click('button-save-surface');
  expect(mocks.api).toHaveBeenCalledWith('PATCH', '/api/admin/surfaces/s', expect.objectContaining({ title: 'Updated shirt', retailPrice: 30 }));
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/admin/surfaces/listings'] });
  expect(tree.root.findAllByProps({ 'data-testid': 'input-surface-title' })).toHaveLength(0);
});
it('keeps unsaved item edits after a failed save and respects discard cancellation', async () => {
  mocks.api.mockImplementation(async (method: string) => { if (method === 'PATCH') throw new Error('Save unavailable'); return { json: async () => surface }; });
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [listing] });
  await click('button-setup-item');
  await act(async () => { tree.root.findByProps({ 'data-testid': 'input-surface-title' }).props.onChange({ target: { value: 'Keep this edit' } }); });
  await click('button-save-surface');
  expect(tree.root.findByProps({ 'data-testid': 'input-surface-title' }).props.value).toBe('Keep this edit');
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Save failed' }));
  vi.mocked(window.confirm).mockReturnValue(false);
  await click('button-cancel-surface');
  expect(tree.root.findByProps({ 'data-testid': 'input-surface-title' }).props.value).toBe('Keep this edit');
});
it('opens a newly generated item from its detail endpoint before the list refreshes, then continues to account choice', async () => {
  mocks.api.mockImplementation(async (method: string, path: string) => ({ json: async () => path.endsWith('generate-from-instance') ? { surfaceId: 's' } : method === 'GET' ? surface : { success: true } }));
  await mount(ListingsSection);
  await click('button-generate-surface');
  await select('select-generate-instance', 'built');
  await click('button-generate-confirm');
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/admin/surfaces/generate-from-instance', { instanceId: 'built', marketplace: 'ebay' });
  expect(tree.root.findByProps({ 'data-testid': 'input-surface-title' }).props.value).toBe('Shirt');
  await click('button-save-surface');
  expect(tree.root.findByProps({ 'data-testid': 'select-listing-surface' })).toBeDefined();
});
it('limits account choices to enabled marketplaces and clears the account when the item changes', async () => {
  await mount(ListingsSection, undefined, { '/api/admin/surfaces': [surface, { ...surface, id: 'other', enabledPlatforms: ['ebay'] }], '/api/admin/surfaces/accounts': [
    { id: 'seller', platform: 'amazon', accountName: 'Amazon seller', isActive: true },
    { id: 'ebay', platform: 'ebay', accountName: 'eBay seller', isActive: true },
    { id: 'inactive', platform: 'amazon', accountName: 'Inactive seller', isActive: false },
  ] });
  await click('button-add-listing');
  await select('select-listing-surface', 's');
  let snapshot = JSON.stringify(tree.toJSON());
  expect(snapshot).toContain('Amazon seller');
  expect(snapshot).not.toContain('eBay seller');
  expect(snapshot).not.toContain('Inactive seller');
  await select('select-listing-account', 'seller');
  expect(tree.root.findByProps({ 'data-testid': 'button-save-listing' }).props.disabled).toBe(false);
  await select('select-listing-surface', 'other');
  expect(tree.root.findByProps({ 'data-testid': 'button-save-listing' }).props.disabled).toBe(true);
});
it('keeps failed publishing job retries wired in Activity', async () => {
  mocks.api.mockResolvedValue({ json: async () => ({ success: true, listingStatus: 'active' }) });
  await mount(ActivitySection, undefined, { '/api/admin/surfaces/jobs': [{ id: 'job', status: 'failed', platform: 'amazon', action: 'create', attempts: 1, maxAttempts: 3, createdAt: '2026-10-07' }] });
  await click('button-retry-job-job');
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/admin/surfaces/jobs/job/retry', {});
});
it('retains Etsy requirements on the listing-specific seller setup', async () => {
 const settings={taxonomyId:123,shippingProfileId:456,readinessStateId:789,returnPolicyId:321,whoMade:'someone_else',whenMade:'made_to_order',quantity:10,autoRenew:false,productionPartnerIds:[]};
 const options={categories:[],shippingProfiles:[],processingProfiles:[],returnPolicies:[],productionPartners:[],currency:'USD'};
 const Component=()=>React.createElement(EtsySetupDialog,{listing:{...listing,platform:'etsy',accountId:'etsy'},onClose:vi.fn()});
 mocks.api.mockResolvedValue({json:async()=>({settings,options,shopName:'Selected shop',variants:[]})});
 await mount(Component);
 await click('button-save-etsy-setup');
 expect(mocks.api).toHaveBeenCalledWith('PATCH','/api/admin/surfaces/listings/item/etsy-setup',{settings});
 expect(mocks.api.mock.calls.every(call=>call[1].includes('/listings/item/etsy-setup'))).toBe(true);
});

it('checks and ends eBay listings through distinct job actions without deleting the record', async () => {
  mocks.api.mockResolvedValue({ json: async () => ({ success: true, listingStatus: 'delisted' }) });
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [{ ...listing, platform: 'ebay', status: 'active', externalListingId: 'live', externalOfferId: 'offer' }] });
  expect(tree.root.findByProps({ 'data-testid': 'button-delete-listing-item' }).props.disabled).toBe(true);
  await click('button-ebay-status-item');
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/admin/surfaces/jobs', { listingId: 'item', action: 'check_status' });
  await click('button-ebay-end-item');
  expect(window.confirm).toHaveBeenCalled();
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/admin/surfaces/jobs', { listingId: 'item', action: 'delete' });
  expect(mocks.api.mock.calls.some(call => call[0] === 'DELETE')).toBe(false);
});
it('opens eBay setup before first publication and saves policies for the existing listing', async () => {
  const settings = { fulfillmentPolicyId: 'ship', paymentPolicyId: 'pay', returnPolicyId: 'return', merchantLocationKey: 'location' };
  const setup = { categoryId: '123', settings, itemSpecifics: { Department: 'Unisex Adults' }, variants: [], options: { fulfillmentPolicies: [{ fulfillmentPolicyId: 'ship', name: 'Shipping' }], paymentPolicies: [{ paymentPolicyId: 'pay', name: 'Payment' }], returnPolicies: [{ returnPolicyId: 'return', name: 'Return' }], locations: [{ merchantLocationKey: 'location', name: 'Warehouse' }], categories: [], aspects: [{ name: 'Department', required: true, mode: 'FREE_TEXT', values: [] }] } };
  mocks.api.mockImplementation(async (method: string) => ({ json: async () => method === 'GET' ? setup : { success: true } }));
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [{ ...listing, platform: 'ebay' }] });
  await click('button-publish-item');
  expect(mocks.api).toHaveBeenCalledWith('GET', '/api/admin/surfaces/listings/item/ebay-setup');
  expect(mocks.api.mock.calls.some(call => call[1] === '/api/admin/surfaces/jobs')).toBe(false);
  expect(tree.root.findByProps({ 'data-testid': 'button-save-ebay-setup' }).props.disabled).toBe(false);
  await click('button-save-ebay-setup');
  expect(mocks.api).toHaveBeenCalledWith('PATCH', '/api/admin/surfaces/listings/item/ebay-setup', { categoryId: '123', settings, itemSpecifics: setup.itemSpecifics });
  expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/admin/surfaces/listings'] });
});
it('shows failed eBay policy reads and blocks saving incomplete setup', async () => {
  mocks.api.mockRejectedValue(new Error('Seller authorization expired'));
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [{ ...listing, platform: 'ebay' }] });
  await click('button-ebay-setup-item');
  expect(JSON.stringify(tree.toJSON())).toContain('Seller authorization expired');
  expect(tree.root.findByProps({ 'data-testid': 'button-save-ebay-setup' }).props.disabled).toBe(true);
});

it('wires Amazon status and whole-family removal to the selected listing job', async () => {
  mocks.api.mockResolvedValue({ json: async () => ({ success: true }) });
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [{ ...listing, status: 'active', amazonItems: [{ sku: 'SKU', parent: true }, { sku: 'SKU:0101' }] }] });
  await click('button-amazon-status-item');
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/admin/surfaces/jobs', { listingId: 'item', action: 'check_status' });
  await click('button-amazon-remove-item');
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('all its variations'));
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/admin/surfaces/jobs', { listingId: 'item', action: 'delete' });
});
it('opens Amazon Setup before first publish and saves without submitting a listing', async () => {
  mocks.api.mockImplementation(async (method: string) => ({ json: async () => method === 'GET' ? { productType: 'SHIRT', settings: { productType: 'SHIRT', quantity: 0, attributes: {} }, variants: [], options: { productTypes: [], schema: { properties: {} } } } : { success: true } }));
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [listing] });
  await click('button-publish-item');
  expect(mocks.api).toHaveBeenCalledWith('GET', '/api/admin/surfaces/listings/item/amazon-setup');
  await click('button-save-amazon-setup');
  expect(mocks.api).toHaveBeenCalledWith('PATCH', '/api/admin/surfaces/listings/item/amazon-setup', expect.objectContaining({ settings: expect.objectContaining({ productType: 'SHIRT', quantity: 0 }) }));
  expect(mocks.api.mock.calls.some(call => call[1] === '/api/admin/surfaces/jobs')).toBe(false);
});
it('preserves Amazon setup and displays a save failure', async () => {
  mocks.api.mockImplementation(async (method: string) => { if (method === 'PATCH') throw new Error('Connection lost'); return { json: async () => ({ productType: 'SHIRT', settings: { productType: 'SHIRT', quantity: 7, attributes: {} }, variants: [], options: { productTypes: [], schema: { properties: {} } } }) }; });
  await mount(ListingsSection, undefined, { '/api/admin/surfaces/listings': [listing] });
  await click('button-amazon-setup-item'); await click('button-save-amazon-setup');
  expect(JSON.stringify(tree.toJSON())).toContain('Connection lost');
  expect(tree.root.findByProps({ id: 'amazon-quantity' }).props.value).toBe(7);
});
