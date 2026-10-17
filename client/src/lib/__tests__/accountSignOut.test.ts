import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Account from '@/pages/account';

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), cancel: vi.fn(), clear: vi.fn(), navigate: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/firebase', () => ({ signOut: mocks.signOut }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'fixture-user', email: 'fixture@example.test' }, isAuthenticated: true, isLoading: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: vi.fn(), queryClient: { cancelQueries: mocks.cancel, clear: mocks.clear } }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isLoading: false }), useMutation: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('wouter', () => ({ useLocation: () => ['/account', mocks.navigate], Link: ({ children, href }: any) => React.createElement('a', { href }, children) }));
vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/components/ui/tabs', () => {
  const box = ({ children }: any) => React.createElement('div', null, children);
  return { Tabs: box, TabsContent: box, TabsList: box, TabsTrigger: box };
});
vi.mock('@/components/ui/avatar', () => {
  const box = ({ children }: any) => React.createElement('div', null, children);
  return { Avatar: box, AvatarFallback: box, AvatarImage: () => null };
});
let tree: ReactTestRenderer;
const button = () => tree.root.findAllByType('button').find(node => node.props['data-testid'] === 'button-logout')!;
beforeEach(async () => {
  vi.resetAllMocks();
  mocks.signOut.mockResolvedValue(undefined);
  mocks.cancel.mockResolvedValue(undefined);
  await act(async () => { tree = create(React.createElement(Account)); });
});
afterEach(() => { act(() => tree.unmount()); });
it('awaits canonical Firebase sign-out, cancels cached account reads, clears data, then returns home', async () => {
  await act(async () => { await button().props.onClick(); });
  expect(mocks.signOut).toHaveBeenCalledTimes(1);
  expect(mocks.cancel).toHaveBeenCalledTimes(1);
  expect(mocks.clear).toHaveBeenCalledTimes(1);
  expect(mocks.navigate).toHaveBeenCalledWith('/');
  expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(mocks.cancel.mock.invocationCallOrder[0]);
  expect(mocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(mocks.clear.mock.invocationCallOrder[0]);
  expect(mocks.clear.mock.invocationCallOrder[0]).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0]);
});
it('retains the account and exposes a retryable error when private-session or Firebase sign-out fails', async () => {
  mocks.signOut.mockRejectedValueOnce(new Error('Private session could not be cleared'));
  await act(async () => { await button().props.onClick(); });
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign out failed', description: 'Private session could not be cleared', variant: 'destructive' }));
  expect(button().props.disabled).toBe(false);
  await act(async () => { await button().props.onClick(); });
  expect(mocks.signOut).toHaveBeenCalledTimes(2);
  expect(mocks.navigate).toHaveBeenCalledWith('/');
});
it('locks repeated taps until the existing sign-out finishes', async () => {
  let finish!: () => void;
  mocks.signOut.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => {
    const click = button().props.onClick;
    pending = click();
    await click();
  });
  expect(mocks.signOut).toHaveBeenCalledTimes(1);
  expect(button().props.disabled).toBe(true);
  expect(mocks.navigate).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; });
  expect(button().props.disabled).toBe(false);
});
