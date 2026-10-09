import { beforeEach, describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import Stripe from 'stripe';
const m = vi.hoisted(() => ({ finalize: vi.fn(), fulfill: vi.fn(), confirmEmbed: vi.fn(), email: vi.fn() }));
vi.mock('../../core', () => ({ db: {} }));
vi.mock('../order-service', () => ({ finalizeCartPayment: m.finalize, confirmEmbedOrderPayout: m.confirmEmbed, writePayoutAttribution: vi.fn() }));
vi.mock('../order-fulfillment', () => ({ fulfillOrder: m.fulfill }));
vi.mock('../email', () => ({ sendOrderConfirmation: m.email }));
import { register } from '../../routes/stripe-webhooks';
const app = express(); app.use(express.json({ verify: (req, _res, body) => { (req as any).rawBody = body; } })); register(app);
const stripe = new Stripe('sk_test_fixture');
const secret = 'whsec_test_fixture';
function event(paymentStatus = 'paid') { return JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', metadata: { source: 'direct_cart', userId: 'buyer', orderId: 'order' }, payment_status: paymentStatus } } }); }
function send(payload = event(), signature = stripe.webhooks.generateTestHeaderString({ payload, secret })) {
  return request(app).post('/webhooks/stripe').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
}
beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture'; process.env.STRIPE_WEBHOOK_SECRET = secret; vi.resetAllMocks();
  m.finalize.mockResolvedValue({ orderId: 'order', order: {}, items: [] }); m.fulfill.mockResolvedValue({ success: true });
});
describe('Stripe signature and production delivery', () => {
  it('verifies exact bytes and resumes fulfillment on repeated notifications', async () => {
    expect((await send()).status).toBe(200); expect((await send()).status).toBe(200);
    expect(m.finalize).toHaveBeenCalledTimes(2); expect(m.fulfill).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid signatures before touching orders', async () => {
    expect((await send(event(), 'invalid')).status).toBe(400); expect(m.finalize).not.toHaveBeenCalled(); expect(m.fulfill).not.toHaveBeenCalled();
  });
  it('does not print unpaid completed sessions', async () => {
    expect((await send(event('unpaid'))).status).toBe(200); expect(m.finalize).not.toHaveBeenCalled(); expect(m.fulfill).not.toHaveBeenCalled();
  });
  it('returns failure so Stripe retries a provider outage', async () => {
    m.fulfill.mockRejectedValue(new Error('Provider unavailable'));
    expect((await send()).status).toBe(500);
  });
  it('does not fulfill when payment and frozen order differ', async () => {
    m.finalize.mockRejectedValue(new Error('Payment does not match'));
    expect((await send()).status).toBe(500); expect(m.fulfill).not.toHaveBeenCalled();
  });
});
