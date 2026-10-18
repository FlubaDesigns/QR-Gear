import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock('@/features/shared/components/wizardSteps', () => ({ getAuthHeaders: m.headers }));
vi.mock('@/lib/memberFetch', () => ({ memberFetch: async () => ({ summary: { total: 0, pending: 0, paid: 0, profitShare: 0.25 } }) }));
import { PayoutsView } from '../features/members/PayoutsView';
let tree: ReactTestRenderer;
let client: QueryClient;
afterEach(() => { act(() => tree?.unmount()); client?.clear(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('renews an expired link through the authenticated POST only after the member continues', async () => {
  const location = { search: '?connect_refresh=true', href: 'https://qrgear-c1ffd.web.app/members?connect_refresh=true' };
  vi.stubGlobal('window', { location, history: { replaceState: vi.fn() } });
  m.headers.mockResolvedValue({ Authorization: 'Bearer owner-token' });
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.method === 'POST'
    ? { url: 'https://fixture.invalid/stripe' }
    : { connected: true, payoutsEnabled: false, onboardingComplete: false, profitSharePercent: 0.25 } }));
  vi.stubGlobal('fetch', fetchMock);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(PayoutsView, { memberId: 'owner' })));
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  await act(async () => {
    tree.root.findByProps({ 'data-testid': 'button-refresh-onboarding' }).props.onClick();
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(fetchMock).toHaveBeenCalledWith('/api/connect/onboard', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer owner-token' }) }));
  expect(location.href).toBe('https://fixture.invalid/stripe');
});
