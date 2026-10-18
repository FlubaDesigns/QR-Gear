import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, uid: 'owner' }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, admin: { auth: () => ({ verifyIdToken: async () => ({ uid: m.uid }) }), firestore: { FieldValue: { serverTimestamp: () => 'now' } } } }));
vi.mock('../order-fulfillment', () => ({ resolveSaleItem: async ({ quantity, customization }: any) => ({ productId: 'p', quantity, price: '25', customization }) }));
import { register } from '../../routes/core-routes';
let store: Map<string, any>;
beforeEach(() => { m.uid = 'owner'; const f = database(); m.db = f.db; store = f.store; });
it('imports once across a lost-response retry and scopes receipts to the owner', async () => {
 const app = express(); app.use(express.json()); register(app);
 const post = (quantity = 1) => request(app).post('/cart').set('Authorization', 'Bearer valid').send({ guestCartId: 'guest_123', quantity, customization: { packetId: 'p' } });
 const first = await post(), second = await post(); expect(first.status).toBe(200); expect(second.body.id).toBe(first.body.id);
 expect([...store.keys()].filter(k => k.startsWith('cartItems/'))).toHaveLength(1);
 expect((await post(2)).status).toBe(409);
 store.delete(`cartItems/${first.body.id}`); expect((await post()).body.alreadyImported).toBe(true);
 m.uid = 'other'; expect((await post()).body.id).not.toBe(first.body.id);
});
