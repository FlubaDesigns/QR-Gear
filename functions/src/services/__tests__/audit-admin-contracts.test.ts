import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, WIDGET_JWT_SECRET: 'fixture-widget-secret' }));
vi.mock('../../middleware', () => ({ requireAdmin: (req: any, res: any, next: any) => req.headers['x-admin'] === 'yes' ? next() : res.status(401).end(), requireAuth: (_req: any, _res: any, next: any) => next() }));
vi.mock('../health-monitor', () => ({ HealthMonitorService: class { async getOverview() { return { providers: [] }; } } }));
import { register as crud } from '../../routes/am-crud';
import { register as sync } from '../../routes/am-sync';
import { register as widget } from '../../routes/widget';
import { orderNeedsFulfillment, orderNetRevenueCents } from '../order-reporting';
let store: Map<string, any>;
const app = express(); app.use(express.json()); crud(app); sync(app); widget(app);
beforeEach(() => {
  const now = new Date().toISOString();
  const fixture = database({
    'users/current': { email: 'current@example.test', createdAt: now },
    'customers/legacy': { userId: 'current', email: 'old@example.test', createdAt: now },
    'orders/one': { userId: 'current', totalAmount: '25.00', paymentStatus: 'paid', fulfillmentState: 'ready', createdAt: now },
    'orders/two': { customerId: 'legacy', totalAmount: '30.00', paymentStatus: 'paid', fulfillmentState: 'failed', createdAt: now },
    'orders/unpaid': { userId: 'current', totalAmount: '100.00', paymentStatus: 'unpaid', fulfillmentState: 'waiting_for_payment', createdAt: now },
    'orders/refund': { userId: 'current', amountTotalCents: 2000, paymentStatus: 'partially_refunded', refund: { refundedAmountCents: 500 }, createdAt: now },
  }); m.db = fixture.db; store = fixture.store;
  const run = m.db.runTransaction; let tail = Promise.resolve();
  m.db.runTransaction = (fn: any) => { const result = tail.then(() => run(fn)); tail = result.catch(() => {}); return result; };
});
it('reports paid net revenue in dollars and actionable current fulfillment states', async () => {
  const r = await request(app).get('/admin/dashboard/metrics').set('x-admin', 'yes');
  expect(r.status).toBe(200); expect(r.body.revenue).toMatchObject({ today: 70, week: 70, month: 70 });
  expect(r.body.orders.pending).toBe(2); expect(r.body.customers.total).toBe(1);
  expect(orderNeedsFulfillment({ paymentStatus: 'paid', fulfillmentState: 'ready', productionHold: true })).toBe(false);
  expect(orderNetRevenueCents({ paymentStatus: 'refunded', amountTotalCents: 9999 })).toBe(0);
});
it('lists current users once and joins canonical plus explicit legacy order ownership', async () => {
  const list = await request(app).get('/admin/customers').set('x-admin', 'yes');
  expect(list.body).toEqual([expect.objectContaining({ id: 'current', email: 'current@example.test', orderCount: 4, totalSpent: 70 })]);
  for (const id of ['current', 'legacy']) {
    const detail = await request(app).get(`/admin/customers/${id}`).set('x-admin', 'yes');
    expect(detail.status).toBe(200); expect(detail.body.customer.totalSpent).toBe(70); expect(detail.body.recentOrders).toHaveLength(4);
  }
});
it('rejects duplicate triggers on concurrent create, PUT and PATCH, including disabled templates', async () => {
  const results = await Promise.all([true, false].map(isEnabled => request(app).post('/admin/email-templates').set('x-admin', 'yes').send({ trigger: 'order_confirmation', name: 'Confirmation', subject: 'Thanks', isEnabled })));
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  const other = await request(app).post('/admin/email-templates').set('x-admin', 'yes').send({ trigger: 'order_shipped', subject: 'Shipped' });
  for (const method of ['put', 'patch'] as const) expect((await request(app)[method](`/admin/email-templates/${other.body.id}`).set('x-admin', 'yes').send({ trigger: 'order_confirmation', isEnabled: false })).status).toBe(409);
  const retained = [...store].filter(([path, value]) => path.startsWith('email_templates/') && value.trigger === 'order_confirmation');
  expect(retained).toHaveLength(1); expect(store.get('emailTemplateTriggers/order_confirmation').templateId).toBe(retained[0][0].split('/')[1]);
});
it('verifies real widget signatures and expiry without echoing arbitrary bearer input', async () => {
  for (const token of ['not-a-jwt', jwt.sign({ businessName: 'Fixture' }, 'wrong-secret'), jwt.sign({ businessName: 'Fixture' }, 'fixture-widget-secret', { expiresIn: -1 })]) {
    const r = await request(app).get('/widget/verify').query({ token }); expect(r.body.valid).toBe(false); expect(r.body.payload).toBeUndefined();
  }
  const token = jwt.sign({ businessName: 'Fixture' }, 'fixture-widget-secret', { expiresIn: 60 });
  const r = await request(app).get('/widget/verify').query({ token }); expect(r.body).toMatchObject({ valid: true, payload: { businessName: 'Fixture' } });
});
it('keeps admin customer and template endpoints protected', async () => {
  expect((await request(app).get('/admin/customers')).status).toBe(401);
  expect((await request(app).post('/admin/email-templates').send({ trigger: 'order_confirmation' })).status).toBe(401);
});
