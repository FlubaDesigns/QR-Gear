import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, payment: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...args: any[]) => m.db.collection(...args), runTransaction: (...args: any[]) => m.db.runTransaction(...args) }, admin: {} }));
vi.mock('../fluba-provider-keys', () => ({ readFlubaProviderKey: async () => 'fixture' }));
vi.mock('stripe', () => ({ default: class { paymentIntents = { retrieve: m.payment }; } }));
import { recordChargeRefund, assertProductionPayment } from '../payment-state';
import { finalizeCartPayment } from '../order-service';
import { fulfillOrder, syncFulfillment } from '../order-fulfillment';
import { printfulClient } from '../printful';
let store: Map<string, any>;
const order = () => ({ checkoutVersion: 1, source: 'direct_cart', userId: 'buyer', paymentStatus: 'paid', paymentVerifiedAt: '2026-01-01', amountTotalCents: 4000, currency: 'usd', stripePaymentIntentId: 'pi_fixture', stripeSessionId: 'cs_fixture' });
const charge = (amount = 4000) => ({ id: 'ch_fixture', payment_intent: 'pi_fixture', amount: 4000, amount_refunded: amount, currency: 'usd', paid: true, transfer: { id: 'tr_fixture', amount_reversed: 400 } } as any);
beforeEach(() => { vi.clearAllMocks(); const f = database({ 'orders/o': order(), 'member_earnings/e': { orderId: 'o', status: 'transferred', earnings: 4 } }); m.db = f.db; store = f.store; });
it('durably holds full and partial refunds and preserves actual reversal evidence', async () => {
  await recordChargeRefund(charge(1000)); expect(store.get('orders/o')).toMatchObject({ paymentStatus: 'partially_refunded', productionHold: true });
  await recordChargeRefund(charge()); await recordChargeRefund(charge(1000));
  expect(store.get('paymentRefunds/pi_fixture').refundedAmountCents).toBe(4000);
  expect(store.get('orders/o').paymentStatus).toBe('refunded'); expect(store.get('member_earnings/e').status).toBe('needs_review');
});
it('rejects a delayed production retry when Stripe knows a refund before the webhook arrives', async () => {
  m.payment.mockResolvedValue({ status: 'succeeded', amount_received: 4000, currency: 'usd', latest_charge: charge() });
  const provider = vi.spyOn(printfulClient, 'getOrder');
  await expect(fulfillOrder('o')).rejects.toThrow('refunded'); expect(provider).not.toHaveBeenCalled(); provider.mockRestore();
  expect(store.get('orders/o').productionHold).toBe(true);
});
it('prevents checkout replay from restoring a refunded payment, including refund-first delivery', async () => {
  const payment = { id: 'cs_fixture', payment_status: 'paid', payment_intent: 'pi_fixture', amount_total: 4000, currency: 'usd', metadata: { source: 'direct_cart', orderId: 'o', userId: 'buyer' } } as any;
  store.get('orders/o').stripePaymentIntentId = null; store.get('orders/o').paymentStatus = 'unpaid';
  await recordChargeRefund(charge()); await expect(finalizeCartPayment(payment)).rejects.toThrow('Refunded');
  expect(store.get('orders/o').paymentStatus).toBe('unpaid');
});
it('permits an exact unrefunded payment and denies amount mismatch or disputes', async () => {
  const p = { status: 'succeeded', amount_received: 4000, currency: 'usd', latest_charge: charge(0) }; m.payment.mockResolvedValue(p);
  await expect(assertProductionPayment(order())).resolves.toBeUndefined(); p.latest_charge.disputed = true; await expect(assertProductionPayment(order())).rejects.toThrow('not available');
  p.latest_charge.disputed = false; p.amount_received = 1; await expect(assertProductionPayment(order())).rejects.toThrow('not available');
});
it('preserves a refund arriving during shipping sync while saving shipment evidence', async () => {
  Object.assign(store.get('orders/o'), { routedProvider: 'printful', providerOrderId: '123', status: 'routed' });
  const provider = vi.spyOn(printfulClient, 'getOrder').mockImplementation(async () => {
    await recordChargeRefund(charge());
    return { id: 123, external_id: 'o', status: 'fulfilled', shipments: [{ tracking_number: 'TRACK' }] } as any;
  });
  try {
    const result = await syncFulfillment('o');
    expect(result.status).toBe('refunded');
    expect(store.get('orders/o')).toMatchObject({ status: 'refunded', paymentStatus: 'refunded', productionHold: true, trackingNumber: 'TRACK', providerStatus: 'fulfilled' });
  } finally { provider.mockRestore(); }
});
