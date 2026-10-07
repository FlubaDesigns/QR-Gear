import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminRun from '@/pages/admin-run';

const mocks = vi.hoisted(() => ({ api: vi.fn(), admin: vi.fn(), navigate: vi.fn() }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: mocks.api, queryClient: { invalidateQueries: vi.fn() } }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: mocks.admin }));
vi.mock('wouter', () => ({ useLocation: () => ['/admin', mocks.navigate] }));
vi.mock('@/components/AdminShell', () => ({ default: ({ children }: any) => React.createElement('main', null, children) }));
let tree: ReactTestRenderer;
let client: QueryClient;
const flush = () => new Promise(resolve => setTimeout(resolve, 10));
const text = () => JSON.stringify(tree.toJSON());
const toggle = () => tree.root.findAllByType('button').find(b => b.props['data-testid'] === 'button-dashboard-todo')!;
async function settle() { for (let i = 0; i < 3; i++) await act(async () => { await flush(); }); }
async function click() { await act(async () => { toggle().props.onClick(); await flush(); }); await settle(); }
async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async () => null }, mutations: { retry: false } } });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(AdminRun))); await flush(); });
  await settle();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ sessions: [] });
  mocks.api.mockResolvedValue({ json: async () => ({ items: [{ id: 'connect-to-surfaces', title: 'Connect to surfaces', reason: 'Complete surface connections', priority: 'next', category: 'place', href: '/admin/marketplaces' }] }) });
});
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); });
it('opens the existing queue from the current dashboard with a large accessible button', async () => {
  await mount();
  expect(toggle().props.className).toContain('min-h-[72px]');
  expect(toggle().props.className).toContain('w-full');
  expect(toggle().props['aria-expanded']).toBe(false);
  expect(mocks.api).not.toHaveBeenCalled();
  await click();
  expect(toggle().props['aria-expanded']).toBe(true);
  expect(mocks.api).toHaveBeenCalledWith('GET', '/api/admin/dashboard/queue');
  expect(text()).toContain('Connect to surfaces');
  const task = tree.root.findAllByType('button').find(b => b.props['data-testid'] === 'queue-item-connect-to-surfaces')!;
  act(() => task.props.onClick());
  expect(mocks.navigate).toHaveBeenCalledWith('/admin/marketplaces');
  await click();
  expect(text()).not.toContain('Connect to surfaces');
  await click();
  expect(tree.root.findAllByType('button').filter(b => b.props['data-testid'] === 'queue-item-connect-to-surfaces')).toHaveLength(1);
});
it('shows an API failure instead of claiming the list is empty, and retries', async () => {
  mocks.api.mockRejectedValueOnce(new Error('Connection unavailable'));
  await mount(); await click();
  expect(text()).toContain('Connection unavailable');
  expect(text()).not.toContain('All clear');
  const retry = tree.root.findAllByType('button').find(b => b.children.includes('Retry'))!;
  await act(async () => { retry.props.onClick(); await flush(); }); await settle();
  expect(text()).toContain('Connect to surfaces');
});
it('reports a malformed queue response', async () => {
  mocks.api.mockResolvedValue({ json: async () => ({}) });
  await mount(); await click();
  expect(text()).toContain('Invalid to-do list response');
  expect(text()).not.toContain('All clear');
});
