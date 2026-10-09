import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ prepare: vi.fn(), quote: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: () => ({ doc: () => ({ update: m.update }) }) } }));
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next(), requireAuth: (req: any, _res: any, next: any) => { req.user = { uid: 'buyer' }; next(); } }));
vi.mock('../order-service', () => ({ prepareCartOrder: m.prepare, readCartQuote: m.quote }));
vi.mock('stripe', () => ({ default: class { checkout = { sessions: { create: m.create } }; } }));
import { registerCoreCheckoutRoutes } from '../../routes/core-routes-checkout';
const app = express(); app.use(express.json()); registerCoreCheckoutRoutes(app);
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('STRIPE_SECRET_KEY', 'test-only');
  m.prepare.mockResolvedValue({ orderId: 'order', amount: 10935, items: [
    { productTitle: 'Army', customization: { productColor: 'Navy', productSize: 'M' }, quantity: 2, unitAmount: 3400, lineTotalCents: 6500, discountCents: 300 },
    { productTitle: 'Lincoln', customization: { productColor: 'Navy', productSize: 'M' }, quantity: 1, unitAmount: 4883, lineTotalCents: 4435, discountCents: 448 },
  ] });
  m.create.mockResolvedValue({ id: 'session', client_secret: 'secret', url: 'https://payment.example' }); m.update.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe('bundle checkout transport', () => {
  it.each(['/checkout', '/checkout/embedded'])('sends exact discounted cents to Stripe at %s', async path => {
    const bundle = { bundleId: 'pair' };
    const response = await request(app).post(path).send({ bundle, quoteToken: 'reviewed' });
    expect(response.status).toBe(200); expect(m.prepare).toHaveBeenCalledWith('buyer', '', bundle, 'reviewed');
    const session = m.create.mock.calls[0][0];
    expect(session.line_items.reduce((sum: number, row: any) => sum + row.quantity * row.price_data.unit_amount, 0)).toBe(10935);
    expect(session.line_items[0]).toMatchObject({ quantity: 1, price_data: { unit_amount: 6500, product_data: { description: '2 × Navy / M — bundle price applied' } } });
  });
  it('keeps artwork and production snapshots out of the public quote response', async () => {
    m.quote.mockResolvedValue({ quoteToken: 'reviewed', amount: 10935, subtotalCents: 11683, bundle: { id: 'pair' }, offers: [], unavailable: [], items: [{ fulfillment: { files: ['private'] } }] });
    const response = await request(app).post('/checkout/quote').send({ bundle: { bundleId: 'pair' } });
    expect(response.status).toBe(200); expect(response.body.amount).toBe(10935); expect(response.body.items).toBeUndefined();
  });
  it('does not create a payment session when review validation fails', async () => {
    m.prepare.mockRejectedValue(new Error('Your cart or bundle price changed.'));
    const response = await request(app).post('/checkout/embedded').send({ quoteToken: 'stale' });
    expect(response.status).toBe(400); expect(response.body.error).toContain('changed'); expect(m.create).not.toHaveBeenCalled();
  });
});
