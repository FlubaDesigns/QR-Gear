import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a) } }));
import { readCheckoutReceipt } from '../checkout-receipt';
let store: Map<string, any>;
const session = () => ({ id: 'cs', metadata: { userId: 'buyer', orderId: 'o', source: 'direct_cart' }, payment_status: 'paid', amount_total: 2500, currency: 'usd' }) as any;
beforeEach(() => { const f = database({ 'orders/o': { userId: 'buyer', stripeSessionId: 'cs', amountTotalCents: 2500, currency: 'usd', paymentStatus: 'unpaid', createdAt: '2026-10-18', privateNote: 'private' }, 'orderItems/i': { orderId: 'o', productId: 'p', price: '25', quantity: 1, frozenProduction: { secret: true } } }); m.db = f.db; store = f.store; });
it('shows webhook delay as pending then returns the confirmed order and items without private production fields', async () => {
 expect((await readCheckoutReceipt(session(), 'buyer')).state).toBe('confirmation_pending');
 store.get('orders/o').paymentStatus = 'paid'; const result = await readCheckoutReceipt(session(), 'buyer');
 expect(result).toMatchObject({ state: 'confirmed', order: { id: 'o', totalAmount: 25, items: [{ id: 'i', productId: 'p' }] } });
 expect(JSON.stringify(result)).not.toMatch(/private|frozenProduction/);
 store.get('orders/o').paymentStatus = 'refunded'; expect((await readCheckoutReceipt(session(), 'buyer')).state).toBe('refund_review');
});
it('checks buyer, order binding and exact amount', async () => {
 await expect(readCheckoutReceipt(session(), 'other')).rejects.toMatchObject({ status: 403 });
 await expect(readCheckoutReceipt({ ...session(), amount_total: 1 }, 'buyer')).rejects.toMatchObject({ status: 409 });
 store.get('orders/o').stripeSessionId = 'another'; await expect(readCheckoutReceipt(session(), 'buyer')).rejects.toMatchObject({ status: 409 });
});
