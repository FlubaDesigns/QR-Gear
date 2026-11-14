import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ get db() { return m.db; } }));
import { checkoutAttempt, assertCheckoutAttempt, createCheckoutSession } from '../checkout-attempt';
let store: Map<string, any>;
beforeEach(() => {
  const f = database({ 'orders/order': { status: 'awaiting_payment' } }); m.db = f.db; store = f.store;
  const transaction = m.db.runTransaction; let tail = Promise.resolve();
  m.db.runTransaction = (fn: any) => { const result = tail.then(() => transaction(fn)); tail = result.catch(() => {}); return result; };
});
const key = '550e8400-e29b-41d4-a716-446655440000';
const params = { mode: 'payment', metadata: { orderId: 'order' } } as any;
it('binds attempts to an authenticated scope and exact selection independent of object key order', () => {
 const a = checkoutAttempt('cart:alice', key, { amount: 10, proof: 'p' });
 expect(a.id).toMatch(/^[a-f0-9]{32}$/);
 expect(checkoutAttempt('cart:alice', key, { proof: 'p', amount: 10 })).toEqual(a);
 expect(checkoutAttempt('cart:bob', key, { amount: 10, proof: 'p' }).id).not.toBe(a.id);
 expect(() => assertCheckoutAttempt({ checkoutRequestHash: a.requestHash }, checkoutAttempt('cart:alice', key, { amount: 1 }))).toThrow('different selection');
 for (const invalid of ['', null, '../orders', 'x'.repeat(101)]) expect(() => checkoutAttempt('cart', invalid, {})).toThrow('Reload');
});
it('recovers a lost Stripe response with the same persisted parameters and idempotency key', async () => {
 const create = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue({ id: 'cs_one', livemode: true, status: 'open' });
 const stripe = { checkout: { sessions: { create, retrieve: vi.fn().mockResolvedValue({ id: 'cs_one', livemode: true, status: 'open' }) } } } as any;
 await expect(createCheckoutSession(stripe, 'orders', 'order', params)).rejects.toThrow('connection lost');
 await createCheckoutSession(stripe, 'orders', 'order', { ...params, success_url: 'https://changed.invalid' });
 expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
 expect(store.get('orders/order').stripeSessionId).toBe('cs_one');
 await createCheckoutSession(stripe, 'orders', 'order', params);
 expect(create).toHaveBeenCalledTimes(2); expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_one');
});
it('concurrent requests freeze one payload and use one Stripe key', async () => {
 const create = vi.fn(async () => ({ id: 'cs_one', livemode: true, status: 'open' }));
 const stripe = { checkout: { sessions: { create } } } as any;
 await Promise.all([createCheckoutSession(stripe, 'orders', 'order', params), createCheckoutSession(stripe, 'orders', 'order', { ...params, success_url: 'https://other.invalid' })]);
 expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
});
it('blocks an unknown outcome beyond the retry window and confirmed expired sessions without creating again', async () => {
 const create = vi.fn(), retrieve = vi.fn().mockResolvedValue({ id: 'cs_old', livemode: true, status: 'expired' });
 const stripe = { checkout: { sessions: { create, retrieve } } } as any;
 Object.assign(store.get('orders/order'), { stripeCheckoutParams: params, stripeCheckoutStartedAt: Date.now() - 24 * 3600000 });
 await expect(createCheckoutSession(stripe, 'orders', 'order', params)).rejects.toThrow('reconciliation');
 store.get('orders/order').stripeSessionId = 'cs_old';
 await expect(createCheckoutSession(stripe, 'orders', 'order', params)).rejects.toMatchObject({ code: 'checkout_expired' });
 expect(create).not.toHaveBeenCalled();
});
it('never retries a completed order as a new payment and rejects a provider test-mode response', async () => {
 store.get('orders/order').status = 'paid';
 const create = vi.fn().mockResolvedValue({ id: 'cs_test', livemode: false });
 const stripe = { checkout: { sessions: { create } } } as any;
 await expect(createCheckoutSession(stripe, 'orders', 'order', params)).rejects.toThrow('another payment');
 store.get('orders/order').status = 'awaiting_payment';
 await expect(createCheckoutSession(stripe, 'orders', 'order', params)).rejects.toThrow();
 expect(store.get('orders/order').stripeSessionId).toBeUndefined();
});
