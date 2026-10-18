import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Timestamp } from 'firebase-admin/firestore';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, generateGiftCode: () => 'FREE-CODE', admin: {} }));
import { register } from '../../routes/gifts';
import { giftExpiry, assertRedeemableGift } from '../gift-validation';
import { finalizeHostingRenewal } from '../hosting-renewal';
let store: Map<string, any>;
const app = () => { const a = express(); a.use(express.json()); register(a); return a; };
beforeEach(() => { const f = database({
  'gift_packages/paid': { isActive: true, price: '99', name: 'Paid' },
  'gift_packages/free': { isActive: true, price: '0', isFreePromotion: true, redemptionValidDays: 30, name: 'Promotion' },
  'gift_codes/code': { code: 'GIFT', status: 'active', expiresAt: new Date(Date.now() + 60000), giftPackageId: 'free' },
  'hosting_renewals/r': { instanceId: 'i', amountCents: 499, currency: 'usd', durationDays: 1095, status: 'awaiting_payment' },
  'buyer_instances/i': { hostingExpiresAt: '2030-01-01T00:00:00.000Z' },
}); m.db = f.db; store = f.store;
  // Serialize fixture transactions as Firestore does when concurrent writes conflict.
  const transaction = m.db.runTransaction; let tail = Promise.resolve(); m.db.runTransaction = (fn: any) => { const next = tail.then(() => transaction(fn)); tail = next.catch(() => {}); return next; };
});
it('never issues a paid gift and requires explicit free-promotion configuration', async () => {
  const a = app(); expect((await request(a).post('/gifts/purchase').send({ giftPackageId: 'paid' })).status).toBe(409);
  expect((await request(a).get('/gifts/packages')).body.map((p: any) => p.id)).toEqual(['free']);
  expect((await request(a).post('/gifts/purchase').send({ giftPackageId: 'free' })).status).toBe(200);
  expect(store.get('gift_codes/FREE-CODE').issuanceType).toBe('free_promotion');
  store.get('gift_packages/free').isFreePromotion = false; expect((await request(a).post('/gifts/purchase').send({ giftPackageId: 'free' })).status).toBe(409);
});
it('interprets real Firestore Timestamp expiry and rejects missing/invalid expiry', () => {
  const expired = Timestamp.fromDate(new Date('2020-01-01')); expect(giftExpiry(expired)?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  for (const value of [expired, 'bad date', undefined]) expect(() => assertRedeemableGift({ status: 'active', expiresAt: value })).toThrow('expired');
});
it('consumes one gift into one deterministic redemption despite concurrent requests', async () => {
  const a = app(); const results = await Promise.all([1, 2].map(() => request(a).post('/gifts/redeem/GIFT').send({ recipientName: 'Buyer' })));
  expect(results.map(r => r.status).sort()).toEqual([200, 409]); expect([...store.keys()].filter(k => k.startsWith('gift_redemptions/'))).toEqual(['gift_redemptions/code']);
});
const paid = () => ({ id: 'cs_renew', payment_status: 'paid', amount_total: 499, currency: 'usd', payment_intent: 'pi_renew', metadata: { type: 'hosting_renewal', renewalId: 'r', instanceId: 'i' } } as any);
it('credits a renewal exactly once across concurrent webhook/return/replay', async () => {
  const results = await Promise.all([finalizeHostingRenewal(paid()), finalizeHostingRenewal(paid(), 'i')]);
  expect(results.filter(r => r.alreadyProcessed).length).toBe(1); const expiry = store.get('buyer_instances/i').hostingExpiresAt;
  await finalizeHostingRenewal(paid()); expect(store.get('buyer_instances/i').hostingExpiresAt).toBe(expiry);
  expect(new Date(expiry).getTime() - new Date('2030-01-01').getTime()).toBe(1095 * 86400000);
});
it('rejects wrong payment terms, wrong instance and unbound historical payments without credit', async () => {
  for (const patch of [{ amount_total: 1 }, { currency: 'eur' }, { payment_status: 'unpaid' }, { metadata: { type: 'hosting_renewal', instanceId: 'i' } }]) await expect(finalizeHostingRenewal({ ...paid(), ...patch })).rejects.toThrow();
  await expect(finalizeHostingRenewal(paid(), 'another')).rejects.toThrow(); expect(store.get('buyer_instances/i').hostingExpiresAt).toBe('2030-01-01T00:00:00.000Z');
});
