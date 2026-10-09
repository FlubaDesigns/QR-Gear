import { afterEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
vi.mock('../../core', () => ({ db: { collection: () => {
  const query: any = { where: () => query, orderBy: () => query, limit: () => query, get: async () => ({ docs: [], empty: true, size: 0 }) };
  return query;
} } }));
vi.mock('../../middleware', () => ({ requireAdmin: (req: any, res: any, next: any) => req.headers['x-admin'] === 'yes' ? next() : res.status(401).json({ error: 'Unauthorized' }) }));
vi.mock('../email', () => ({ getResendClient: () => null }));
import { register } from '../../routes/admin-dashboard';
const app = express(); register(app);
afterEach(() => vi.unstubAllEnvs());
it('keeps the Fix Stripe task and setup link until live keys and webhook configuration are present', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
  vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_test_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
  for (let i = 0; i < 2; i++) {
    const response = await request(app).get('/admin/dashboard/queue').set('x-admin', 'yes');
    expect(response.body.items.filter((item: any) => item.id === 'stripe-not-live')).toEqual([
      expect.objectContaining({ title: 'Fix Stripe', href: 'https://dashboard.stripe.com/apikeys', priority: 'critical' }),
    ]);
  }
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_fixture'); vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_live_fixture');
  const missingWebhook = await request(app).get('/admin/dashboard/queue').set('x-admin', 'yes');
  expect(missingWebhook.body.items.some((item: any) => item.title === 'Fix Stripe')).toBe(true);
});
it('retains the requested surface task exactly once across reads of the existing admin queue', async () => {
  for (let i = 0; i < 2; i++) {
    const response = await request(app).get('/admin/dashboard/queue').set('x-admin', 'yes');
    expect(response.status).toBe(200);
    expect(response.body.items.filter((item: any) => item.id === 'connect-to-surfaces')).toEqual([
      expect.objectContaining({ title: 'Connect to surfaces', href: '/admin/marketplaces', priority: 'next' }),
    ]);
    expect(response.body.items.some((item: any) => item.id === 'email-not-configured')).toBe(true);
  }
});
it('retains admin authorization', async () => {
  expect((await request(app).get('/admin/dashboard/queue')).status).toBe(401);
});
