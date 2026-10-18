import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, payment: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, admin: { firestore: { FieldValue: { serverTimestamp: () => 'now' } } } }));
vi.mock('../payment-state', () => ({ assertProductionPayment: m.payment }));
vi.mock('../runtime-config', () => ({ requireLiveCommerce: vi.fn(), isSandboxRuntime: () => false }));
import { printifyClient, submitOrderToPrintify } from '../printify';
let store: Map<string, any>;
beforeEach(() => { vi.restoreAllMocks(); m.payment.mockReset().mockResolvedValue(undefined); const f = database({ 'orders/o': { routedProvider: 'printify', paymentVerifiedAt: 'now', paymentStatus: 'paid' }, 'orderItems/i': { orderId: 'o', quantity: 1, customization: { printifyProductId: 'p', printifyVariantId: 1 } } }); m.db = f.db; store = f.store; vi.spyOn(printifyClient, 'isConfigured', 'get').mockResolvedValue(true); });
it('resumes a failed production submission using the saved remote identity', async () => {
 const create = vi.spyOn(printifyClient, 'createOrder').mockResolvedValue({ id: 'remote' });
 vi.spyOn(printifyClient, 'getOrder').mockResolvedValue({ id: 'remote', external_id: 'o', status: 'on-hold' });
 const submit = vi.spyOn(printifyClient, 'submitOrderToProduction').mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce();
 expect((await submitOrderToPrintify('o', {} as any)).success).toBe(false);
 expect(store.get('orders/o').printifySubmissionState).toBe('created');
 expect((await submitOrderToPrintify('o', {} as any)).success).toBe(true);
 expect(create).toHaveBeenCalledTimes(1); expect(submit).toHaveBeenCalledTimes(2);
 expect(store.get('orders/o')).toMatchObject({ printifySubmissionState: 'submitted', status: 'processing', printifyLeaseUntil: 0 });
});
it('reconciles already submitted orders without submitting twice and rejects unknown remote state', async () => {
 store.get('orders/o').printifyOrderId = 'remote';
 const get = vi.spyOn(printifyClient, 'getOrder').mockResolvedValue({ id: 'remote', status: 'in-production' });
 const submit = vi.spyOn(printifyClient, 'submitOrderToProduction');
 expect((await submitOrderToPrintify('o', {} as any)).success).toBe(true); expect(submit).not.toHaveBeenCalled();
 get.mockResolvedValue({ id: 'remote', status: 'canceled' }); expect((await submitOrderToPrintify('o', {} as any)).success).toBe(false);
});
it('rejects a held payment before provider access', async () => {
 m.payment.mockRejectedValue(new Error('refund')); const create = vi.spyOn(printifyClient, 'createOrder');
 expect((await submitOrderToPrintify('o', {} as any)).success).toBe(false); expect(create).not.toHaveBeenCalled();
});
