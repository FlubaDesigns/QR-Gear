import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, WIDGET_JWT_SECRET: 'fixture-secret-only', WIDGET_API_KEY: 'fixture-key' }));
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../health-monitor', () => ({ HealthMonitorService: class { getOverview = async () => ({ providers: [] }); } }));
import { register as crud } from '../../routes/am-crud';
import { register as widget } from '../../routes/widget';
import { saveEmailTemplate, deleteEmailTemplate } from '../email-template-store';
import { orderNetPaidCents, needsFulfillmentAttention } from '../order-metrics';
let store: Map<string, any>;
beforeEach(() => { const f = database({ 'users/buyer': { email: 'buyer@example.test', displayName: 'Current Buyer', createdAt: new Date().toISOString() }, 'orders/o1': { userId: 'buyer', totalAmount: '25.00', paymentStatus: 'paid', fulfillmentState: 'ready', createdAt: new Date().toISOString() }, 'orders/o2': { userId: 'buyer', totalAmount: '30.00', paymentStatus: 'paid', fulfillmentState: 'failed', createdAt: new Date().toISOString() }, 'orders/unpaid': { userId: 'buyer', totalAmount: '100.00', paymentStatus: 'unpaid', createdAt: new Date().toISOString() }, 'products/p': { name: 'QR Shirt', basePrice: '25', isEnabled: true } }); m.db = f.db; store = f.store;
 const run = m.db.runTransaction; let tail = Promise.resolve(); m.db.runTransaction = (fn: any) => { const value = tail.then(() => run(fn)); tail = value.catch(() => {}); return value; };
});
function app() { const a = express(); a.use(express.json()); crud(a); widget(a); return a; }
it('sums paid canonical money, includes current users and joins their actual order history', async () => {
 const metrics = await request(app()).get('/admin/dashboard/metrics'); expect(metrics.status).toBe(200); expect(metrics.body.revenue.today).toBe(55); expect(metrics.body.orders.pending).toBe(2);
 const list = await request(app()).get('/admin/customers'); expect(list.body[0]).toMatchObject({ id: 'buyer', totalSpent: 55, orderCount: 3 });
 const detail = await request(app()).get('/admin/customers/buyer'); expect(detail.body.recentOrders).toHaveLength(3); expect(detail.body.customer.totalSpent).toBe(55);
 expect(orderNetPaidCents({ paymentStatus: 'partially_refunded', amountTotalCents: 3000, refund: { refundedAmountCents: 1000 } })).toBe(2000);
 expect(orderNetPaidCents({ paymentStatus: 'partially_refunded', amountTotalCents: 3000 })).toBeNull();
 expect(needsFulfillmentAttention({ paymentStatus: 'unpaid', fulfillmentState: 'ready' })).toBe(false);
});
it('preserves the legacy read response and verifies signatures and expiry in diagnostics', async () => {
 const token = jwt.sign({ businessName: 'Fixture business' }, 'fixture-secret-only', { expiresIn: '1h' });
 const session = await request(app()).get('/widget/session').query({ token }); expect(session.body).toMatchObject({ products: [{ id: 'p' }] });
 expect((await request(app()).get('/widget/verify').query({ token })).body.valid).toBe(true);
 for (const invalid of ['not-a-jwt', jwt.sign({}, 'wrong-key'), jwt.sign({ exp: 1 }, 'fixture-secret-only')]) expect((await request(app()).get('/widget/verify').query({ token: invalid })).body.valid).toBe(false);
});
it('enforces trigger uniqueness during concurrent creates, edits and disabled templates', async () => {
 const template = { trigger: 'order_confirmation', subject: 'Order received', isEnabled: false };
 const results = await Promise.allSettled([saveEmailTemplate(template), saveEmailTemplate(template)]); expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
 const first = (results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
 const second = await saveEmailTemplate({ trigger: 'order_shipped', subject: 'Shipped' });
 await expect(saveEmailTemplate({ trigger: 'order_confirmation' }, second.id)).rejects.toMatchObject({ status: 409 });
 await deleteEmailTemplate(first.id); expect((await saveEmailTemplate(template)).success).toBe(true);
});
