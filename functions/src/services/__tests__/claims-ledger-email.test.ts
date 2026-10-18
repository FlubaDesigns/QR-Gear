import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, send: vi.fn(), uid: 'first' }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, admin: { auth: () => ({ verifyIdToken: async (token: string) => ({ uid: token }) }) } }));
vi.mock('../fluba-provider-keys', () => ({ readFlubaProviderKey: async () => 'fixture-key-long-enough' }));
vi.mock('resend', () => ({ Resend: class { emails = { send: m.send }; } }));
import { register as claims } from '../../routes/claims';
import { registerExternalSitesPublicRoutes as embed } from '../../routes/external-sites-public';
import { sendActivationEmail } from '../email';
import { writePayoutAttribution } from '../order-service';
import { BUILDER_SESSIONS_COLLECTION } from '../../constants';
let store: Map<string, any>;
const app = () => { const a = express(); a.use(express.json()); claims(a); embed(a); return a; };
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
it('returns an owner-scoped array with document IDs for claimed-item navigation', async () => {
  store.set('claimedInstances/static-item', { ownerUserId: 'first', status: 'static', hostingExpiresAt: null, createdAt: '2026-10-18' });
  store.set('claimedInstances/other-item', { ownerUserId: 'second', status: 'active' });
  const r = await request(app()).get('/claimed-instances').set('Authorization', 'Bearer first');
  expect(r.status).toBe(200); expect(r.body).toEqual([expect.objectContaining({ id: 'static-item', status: 'static' })]);
  expect((await request(app()).get('/claimed-instances/static-item').set('Authorization', 'Bearer first')).body.isActive).toBe(true);
});
