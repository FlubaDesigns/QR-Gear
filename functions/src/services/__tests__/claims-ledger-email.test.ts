import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, send: vi.fn(), uid: 'first' }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, admin: { auth: () => ({ verifyIdToken: async (token: string) => ({ uid: token }) }) } }));
vi.mock('../fluba-provider-keys', () => ({ readFlubaProviderKey: async () => 'fixture-key-long-enough' }));
vi.mock('resend', () => ({ Resend: class { emails = { send: m.send }; } }));
import { register as claims } from '../../routes/claims';
import { registerExternalSitesPublicRoutes as embed } from '../../routes/external-sites-public';
import { sendActivationEmail, sendOrderActivationEmails } from '../email';
import { writePayoutAttribution } from '../order-service';
import { resolveDynamicsInstance } from '../qr-dynamics';
import { register as dynamics } from '../../routes/dynamics';
import { BUILDER_SESSIONS_COLLECTION } from '../../constants';
let store: Map<string, any>;
const app = () => { const a = express(); a.use(express.json()); claims(a); embed(a); dynamics(a); return a; };
beforeEach(() => { vi.clearAllMocks(); const f = database({
  'claimCodes/legacy': { status: 'unclaimed', productName: 'Gift', packetType: 'qr_basics', expiresAt: '2099-01-01' },
  'referrals/original': { buyerKey: 'buyer@example.test', referrerId: 'first', profitSharePercent: 25, createdAt: '2020-01-01' },
  [`${BUILDER_SESSIONS_COLLECTION}/s`]: { status: 'active', anonToken: 'a'.repeat(32), expiresAt: '2099-01-01' },
}); m.db = f.db; store = f.store;
  const transaction = m.db.runTransaction; let tail = Promise.resolve(); m.db.runTransaction = (fn: any) => { const next = tail.then(() => transaction(fn)); tail = next.catch(() => {}); return next; };
  m.send.mockResolvedValue({ data: { id: 'fixture-mail' }, error: null });
});
it('disables legacy embed Buy even with a valid capability, without creating a payment/order', async () => {
  const before = [...store.keys()]; const r = await request(app()).post('/public/embed/session/s/buy').set('Authorization', `Bearer ${'a'.repeat(32)}`).send({ quantity: 1 });
  expect(r.status).toBe(410); expect([...store.keys()]).toEqual(before);
});
it('rejects expired legacy claims and gives concurrent callers only one owner', async () => {
  store.get('claimCodes/legacy').expiresAt = '2020-01-01';
  expect((await request(app()).post('/claim/legacy').set('Authorization', 'Bearer first')).status).toBe(410);
  store.get('claimCodes/legacy').expiresAt = '2099-01-01';
  const responses = await Promise.all(['first', 'second'].map(uid => request(app()).post('/claim/legacy').set('Authorization', `Bearer ${uid}`)));
  expect(responses.filter(r => r.status === 200)).toHaveLength(1);
  expect([...store.keys()].filter(k => k.startsWith('claimedInstances/'))).toHaveLength(1);
  const owner = store.get('claimCodes/legacy').claimedByUserId; expect([...store].find(([k]) => k.startsWith('claimedInstances/'))![1].ownerUserId).toBe(owner);
});
it('escapes activation HTML text and attributes and omits unsafe image URLs', async () => {
  expect(await sendActivationEmail({ customerEmail: 'fixture@example.test', customerName: '<b>Buyer</b>', activationCode: 'CODE/?"', productName: '<a href="https://evil.invalid">Fake</a>', previewImageUrl: 'javascript:alert(1)', orderId: 'o' })).toBe(true);
  const html = m.send.mock.calls[0][0].html;
  expect(html).not.toContain('<a href="https://evil.invalid">'); expect(html).toContain('&lt;a href='); expect(html).not.toContain('javascript:'); expect(html).toContain('/claim/CODE%2F%3F%22'); expect(html).toContain('&lt;b&gt;Buyer&lt;/b&gt;');
});
it('retains pending ledger work and throws on persistence failure, then retries without duplicates', async () => {
  const original = m.db.runTransaction; m.db.runTransaction = (fn: any) => original((tx: any) => fn({ ...tx, create: (ref: any, value: any) => { if (ref.path.startsWith('member_earnings/')) throw new Error('database unavailable'); return tx.create(ref, value); } }));
  const input = { source: 'packet_share' as const, orderId: 'o', orderTotal: 40, productCost: 24, creatorMemberId: 'creator', memberCompensation: { version: 1 as const, currency: 'usd' as const, saleCents: 4000, costCents: 2400, profitCents: 1600, share: 0.25, amountCents: 400 } };
  await expect(writePayoutAttribution(input)).rejects.toThrow('database unavailable'); expect(store.get('payout_work/o').status).toBe('pending');
  m.db.runTransaction = original; await writePayoutAttribution(input); await writePayoutAttribution(input);
  expect(store.get('payout_work/o').status).toBe('completed'); expect([...store.keys()].filter(k => k.startsWith('member_earnings/'))).toEqual(['member_earnings/o_creator']);
});
it('credits the saved original referrer with or without a later share parameter and is idempotent', async () => {
  for (const [id, referrerId] of [['o1', 'later'], ['o2', undefined]]) {
    const input = { source: 'packet_share' as const, orderId: id!, orderTotal: 40, productCost: 24, buyerEmail: 'buyer@example.test', referrerId };
    await writePayoutAttribution(input); await writePayoutAttribution(input);
    expect(store.get(`referral_earnings/${id}_first`)).toMatchObject({ memberId: 'first', earnings: 4 }); expect(store.has(`referral_earnings/${id}_later`)).toBe(false);
  }
  expect(store.get('referrals/original').referrerId).toBe('first');
});
it('returns an owned claimed-item array with IDs and keeps static items active', async () => {
 store.set('claimedInstances/static-item', { ownerUserId: 'first', status: 'static', productName: 'Static QR' });
 store.set('claimedInstances/foreign', { ownerUserId: 'second', status: 'active' });
 const result = await request(app()).get('/claimed-instances').set('Authorization', 'Bearer first');
 expect(result.status).toBe(200); expect(result.body).toHaveLength(1); expect(result.body[0].id).toBe('static-item');
 const detail = await request(app()).get('/claimed-instances/static-item').set('Authorization', 'Bearer first'); expect(detail.body.isActive).toBe(true);
});

afterEach(() => vi.useRealTimers());
function purchased(term = '1_year', status = 'active') {
  store.set('claimCodes/PURCHASED', { status: 'unclaimed', instanceId: 'unit', packetType: status === 'static' ? 'qr_basics' : 'qr_canvas', productName: 'My shirt' });
  store.set('qr_dynamics_instances/unit', { instanceId: 'unit', orderId: 'paid-order', orderItemId: 'line', ownerId: null, packetId: 'unit-packet',
    qrgBaseCode: 'QRG-11111-O-000042', title: 'My shirt', status, claimCode: 'PURCHASED', hostingTierCode: term,
    hostingExpiresAt: null, claimedAt: null, startTimestamp: 1, slots: [{ packetId: 'unit-packet', durationSeconds: 86400, order: 1 }] });
  store.set('productPackets/unit-packet', { status: 'published', ownerType: 'owner', ownerId: null, qrgBaseCode: 'QRG-11111-O-000042',
    composeInstanceId: 'unit', landingPageSlug: 'my-shirt', packetType: 'qr-canvas' });
}
it('first scan asks for the emailed code without exposing it or starting hosting', async () => {
  purchased();
  const before = structuredClone(store.get('qr_dynamics_instances/unit'));
  const r = await request(app()).get('/qr/d/unit');
  expect(r.status).toBe(302); expect(r.headers.location).toBe('/claim?instanceId=unit');
  expect(r.text).not.toContain('PURCHASED'); expect(store.get('qr_dynamics_instances/unit')).toEqual(before);
  await expect(resolveDynamicsInstance('unit')).rejects.toThrow('Activate this item');
});
it('starts one calendar year on verified activation, preserving permanent identities and not restarting on replay', async () => {
  purchased(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2028-02-29T12:00:00Z'));
  const r = await request(app()).post('/claim/PURCHASED').set('Authorization', 'Bearer first').send({ instanceId: 'unit' });
  expect(r.status).toBe(200); expect(r.body.hostingExpiresAt).toBe('2029-03-01T12:00:00.000Z');
  const instance = store.get('qr_dynamics_instances/unit');
  expect(instance).toMatchObject({ ownerId: 'first', claimedAt: '2028-02-29T12:00:00.000Z', hostingExpiresAt: r.body.hostingExpiresAt, qrgBaseCode: 'QRG-11111-O-000042', packetId: 'unit-packet' });
  expect(store.get('claimedInstances/unit').hostingExpiresAt).toBe(r.body.hostingExpiresAt);
  expect(store.get('productPackets/unit-packet').ownerId).toBe('first');
  vi.setSystemTime(new Date('2028-09-01T00:00:00Z'));
  expect((await request(app()).post('/claim/PURCHASED').set('Authorization', 'Bearer first')).status).not.toBe(200);
  expect(store.get('qr_dynamics_instances/unit').hostingExpiresAt).toBe(r.body.hostingExpiresAt);
});
it('retains prepaid multi-year terms and rejects a code belonging to a different scanned item', async () => {
  purchased('3_year'); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
  const wrong = await request(app()).post('/claim/PURCHASED').set('Authorization', 'Bearer first').send({ instanceId: 'other-unit' });
  expect(wrong.status).toBe(409); expect(store.get('qr_dynamics_instances/unit').claimedAt).toBeNull();
  const check = await request(app()).get('/claim/validate/PURCHASED?instanceId=other-unit'); expect(check.body.valid).toBe(false);
  const r = await request(app()).post('/claim/PURCHASED').set('Authorization', 'Bearer first');
  expect(r.body.hostingExpiresAt).toBe('2029-12-01T00:00:00.000Z');
});
it('concurrent claims grant one owner and static QR items never acquire a hosting clock', async () => {
  purchased('1_year', 'static');
  const rs = await Promise.all(['first', 'second'].map(uid => request(app()).post('/claim/PURCHASED').set('Authorization', `Bearer ${uid}`)));
  expect(rs.filter(r => r.status === 200)).toHaveLength(1);
  expect(store.get('qr_dynamics_instances/unit').hostingExpiresAt).toBeNull();
  expect(store.get('claimedInstances/unit').status).toBe('static');
});
it('delivers a distinct activation code for every cart unit and retries only undelivered copies', async () => {
  purchased(); const instance = store.get('qr_dynamics_instances/unit');
  store.set('qr_dynamics_instances/unit2', { ...instance, instanceId: 'unit2', claimCode: 'SECOND' });
  store.set('orders/paid-order', { paymentStatus: 'paid', customerEmail: 'buyer@example.test', customerName: 'Buyer' });
  store.set('orderItems/line', { orderId: 'paid-order', productTitle: 'My shirt', quantity: 2, dynamicsInstanceIds: ['unit', 'unit2'] });
  m.send.mockResolvedValueOnce({ data: { id: 'accepted' } }).mockResolvedValueOnce({ error: { message: 'temporary failure' } });
  expect((await sendOrderActivationEmails(m.db, 'paid-order')).success).toBe(false);
  expect(store.get('qr_dynamics_instances/unit').activationEmailSentAt).toBeTruthy();
  expect(store.get('qr_dynamics_instances/unit2').activationEmailSentAt).toBeUndefined();
  m.send.mockResolvedValue({ data: { id: 'retry' } });
  expect((await sendOrderActivationEmails(m.db, 'paid-order')).success).toBe(true);
  expect(m.send).toHaveBeenCalledTimes(3);
  expect(m.send.mock.calls[2][0].html).toContain('SECOND');
  expect(store.get('qr_dynamics_instances/unit2').hostingExpiresAt).toBeNull();
});
