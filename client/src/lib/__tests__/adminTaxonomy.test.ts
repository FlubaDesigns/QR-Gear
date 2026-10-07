import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ProductTagsContent } from '@/pages/admin-tags';
import { CategoriesContent } from '@/pages/admin-categories';
import { parseProductTags } from '@shared/productTags';
const mocks = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), seed: vi.fn() }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: mocks.api }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/components/AdminShell', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminSectionSubNav', () => ({ default: () => null }));
vi.mock('@/lib/categories', () => ({ getCategories: mocks.get, createCategory: mocks.create, updateCategory: mocks.update, deleteCategory: mocks.remove, seedDefaultCategories: mocks.seed }));
vi.mock('@/components/ui/dialog', () => {
  const Pass = ({ children }: any) => React.createElement('div', null, children);
  return { Dialog: ({ open, children }: any) => React.createElement('div', { 'data-open': open }, children), DialogTrigger: Pass, DialogContent: Pass, DialogHeader: Pass, DialogTitle: Pass, DialogFooter: Pass, DialogClose: Pass };
});
vi.mock('@/components/ui/switch', () => ({ Switch: () => null }));
let tree: ReactTestRenderer, client: QueryClient;
const flush = () => new Promise(resolve => setTimeout(resolve, 5));
const text = () => JSON.stringify(tree.toJSON());
const button = (label: string) => tree.root.findAllByType('button').find(b => b.children.includes(label))!;
async function mount(component: any) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(component))); await flush(); });
  await act(async () => { await flush(); });
}
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue([]); });
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); });
it('rejects the old wrapped response instead of calling filter on an object', () => {
  expect(() => parseProductTags({ categories: [] })).toThrow('invalid');
  expect(() => parseProductTags([null])).toThrow('invalid');
});
it('renders failed tags reads with retry and blocks seed', async () => {
  mocks.api.mockResolvedValue({ json: async () => ({ categories: [] }) }); await mount(ProductTagsContent);
  expect(text()).toContain('Could not load tags'); expect(button('Seed Defaults').props.disabled).toBe(true);
  mocks.api.mockResolvedValue({ json: async () => [] });
  await act(async () => { button('Retry').props.onClick(); await flush(); }); await act(async () => { await flush(); });
  expect(text()).toContain('No tags yet.');
});
it('shows legacy taxonomy values, retains state on failed toggle and reports the failure', async () => {
  mocks.api.mockImplementation((method: string) => method === 'GET' ? Promise.resolve({ json: async () => [{ id: 'one', name: 'Old theme', slug: 'old', taxonomyType: 'legacy', isActive: false }] }) : Promise.reject(new Error('Offline')));
  await mount(ProductTagsContent);
  const toggle = () => tree.root.findAllByType('button').find(b => b.props['data-testid'] === 'badge-category-old')!;
  expect(toggle().props['aria-pressed']).toBe(false);
  await act(async () => { toggle().props.onClick(); await flush(); }); await act(async () => { await flush(); });
  expect(mocks.api).toHaveBeenCalledWith('PUT', '/api/admin/product-categories/one', { isActive: true });
  expect(toggle().props['aria-pressed']).toBe(false); expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Save failed' }));
});
it('distinguishes category read failure from an empty collection and retries', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Offline')); await mount(CategoriesContent);
  expect(text()).toContain('Could not load categories'); expect(button('Seed Defaults')).toBeUndefined(); expect(button('Add').props.disabled).toBe(true);
  await act(async () => { button('Retry').props.onClick(); await flush(); });
  expect(text()).toContain('No categories yet.'); expect(button('Seed Defaults')).toBeDefined();
});
it('updates through the existing categories helper and keeps failed edits open', async () => {
  mocks.get.mockResolvedValue([{ id: 'cat', name: 'Custom', icon: 'Tag', description: '', isActive: true }]); mocks.update.mockRejectedValueOnce(new Error('Offline')); await mount(CategoriesContent);
  act(() => tree.root.findAllByType('button').find(b => b.props['aria-label'] === 'Edit Custom')!.props.onClick());
  act(() => tree.root.findByType('input').props.onChange({ target: { value: '  New name  ' } }));
  await act(async () => { button('Update').props.onClick(); await flush(); });
  expect(mocks.update).toHaveBeenCalledWith('cat', expect.objectContaining({ name: 'New name' }));
  expect(tree.root.findByType('input').props.value).toBe('  New name  ');
  expect(tree.root.findAllByProps({ 'data-open': true }).length).toBe(1);
});
