import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Checkout from '@/pages/checkout';

const mocks = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn() }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: mocks.api }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { id: 'buyer' } }) }));
vi.mock('@/components/Navbar', () => ({ default: () => null }));
vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('wouter', () => ({ useLocation: () => ['/checkout', mocks.navigate], Link: ({ children }: any) => React.createElement('div', null, children) }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }));
vi.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children, options }: any) => React.createElement('section', { 'data-testid': 'stripe', options }, children),
  EmbeddedCheckout: () => null,
}));
let tree: ReactTestRenderer;
let client: QueryClient;
let pick = false;
const flush = () => new Promise(resolve => setTimeout(resolve, 10));
async function settle() { for (let i = 0; i < 3; i++) await act(async () => { await flush(); }); }
const button = (label: string) => tree.root.findAllByType('button').find(b => b.children.includes(label))!;
const stripe = () => tree.root.findAllByType('section').filter(el => el.props['data-testid'] === 'stripe');
async function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async () => [{ id: 'cart', quantity: 2 }], staleTime: Infinity } } });
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client }, React.createElement(Checkout))); await flush(); });
  await settle();
}
async function selectOffer() { act(() => tree.root.findByType('select').props.onChange({ target: { value: 'pair' } })); await settle(); }
beforeEach(() => {
  vi.clearAllMocks(); pick = false;
  vi.stubGlobal('window', { location: { origin: 'https://store.example' } });
  mocks.api.mockImplementation(async (_method, path, body) => {
    if (path.endsWith('/embedded')) return { json: async () => ({ clientSecret: 'test-secret' }) };
    const chosen = !!body?.bundle;
    return { json: async () => ({ quoteToken: chosen ? 'chosen-token' : 'base-token', amount: chosen ? 13615 : 14499, subtotalCents: 14499,
      bundle: chosen ? { name: 'Pair', discountCents: 884 } : null,
      offers: [{ id: 'pair', name: 'Pair', bundleType: pick ? 'pick' : 'fixed', minItems: 2, maxItems: 2,
        items: [{ id: 'army', name: 'Army', quantity: 1 }, { id: 'lincoln', name: 'Lincoln', quantity: 1 }] }] }) };
  });
});
afterEach(() => { if (tree) act(() => tree.unmount()); client?.clear(); vi.unstubAllGlobals(); });
it('shows the server total, then sends the reviewed bundle and token to payment', async () => {
  await mount(); expect(stripe()).toHaveLength(0);
  expect(tree.root.findByProps({ 'data-testid': 'checkout-quoted-total' }).children.join('')).toBe('$144.99');
  await selectOffer();
  expect(tree.root.findByProps({ 'data-testid': 'checkout-quoted-total' }).children.join('')).toBe('$136.15');
  expect(button('Continue to payment').props.disabled).toBe(false);
  act(() => button('Continue to payment').props.onClick());
  expect(tree.root.findByType('select').props.disabled).toBe(true);
  await act(async () => { await stripe()[0].props.options.fetchClientSecret(); });
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/checkout/embedded', {
    returnUrl: 'https://store.example/checkout/success?session_id={CHECKOUT_SESSION_ID}', quoteToken: 'chosen-token', bundle: { bundleId: 'pair' },
  });
  act(() => button('Change order selection').props.onClick()); await settle();
  expect(stripe()).toHaveLength(0); expect(tree.root.findByType('select').props.disabled).toBe(false);
});
it('requires the pick count before quoting and enabling payment', async () => {
  pick = true; await mount(); await selectOffer();
  expect(button('Continue to payment').props.disabled).toBe(true);
  expect(mocks.api.mock.calls.filter(call => call[2]?.bundle)).toHaveLength(0);
  const checks = tree.root.findAllByType('input');
  act(() => checks[0].props.onChange({ target: { checked: true } })); await settle();
  expect(button('Continue to payment').props.disabled).toBe(true);
  act(() => checks[1].props.onChange({ target: { checked: true } })); await settle();
  expect(button('Continue to payment').props.disabled).toBe(false);
  expect(mocks.api).toHaveBeenCalledWith('POST', '/api/checkout/quote', { bundle: { bundleId: 'pair', selectedItems: ['army', 'lincoln'] } });
});
it('blocks payment and exposes a failed price quote', async () => {
  mocks.api.mockRejectedValue(new Error('Saved product price is unavailable.'));
  await mount(); expect(button('Continue to payment').props.disabled).toBe(true); expect(stripe()).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Saved product price is unavailable.');
});
it('exposes a changed-price payment rejection and allows another review', async () => {
  await mount(); act(() => button('Continue to payment').props.onClick());
  mocks.api.mockRejectedValueOnce(new Error('Your cart or bundle price changed.'));
  await act(async () => { await expect(stripe()[0].props.options.fetchClientSecret()).rejects.toThrow('changed'); });
  expect(JSON.stringify(tree.toJSON())).toContain('Your cart or bundle price changed.');
  act(() => button('Change order selection').props.onClick()); await settle(); expect(stripe()).toHaveLength(0);
});
