import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, verify: vi.fn(), context: vi.fn(), send: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, escapeHtml: (v: string) => v.replace(/</g, '&lt;'), admin: { auth: () => ({ verifyIdToken: m.verify }), firestore: { FieldValue: { serverTimestamp: () => 'now' } } } }));
vi.mock('../embed-validation', () => ({ validateEmbedContext: m.context, DEFAULT_BUILDER_PERMISSIONS: { allowSaveDraft: true } }));
import { registerExternalSitesPublicRoutes } from '../../routes/external-sites-public';
import { register as utility } from '../../routes/am-utility';
vi.mock('../email', () => ({ getResendClient: async () => ({ emails: { send: m.send } }), QR_GEAR_FROM_EMAIL: 'test@example.test' }));
import { saveCreatorProfile, findCreatorProfile } from '../creator-slugs';
import { register as members } from '../../routes/members';
import { assertEmbedSession, mutateEmbedSession } from '../embed-session';
import { verifyMemberAuthCF, verifyAuth } from '../../middleware';
import { BUILDER_SESSIONS_COLLECTION } from '../../constants';
const token = 'a'.repeat(32), auth = `Bearer ${token}`;
let store: Map<string, any>;
const app = () => { const a = express(); a.use(express.json()); registerExternalSitesPublicRoutes(a); utility(a); members(a); return a; };
beforeEach(() => { vi.clearAllMocks(); m.verify.mockResolvedValue({ uid: 'owner' }); const f = database({ [`${BUILDER_SESSIONS_COLLECTION}/s`]: { anonToken: token, expiresAt: new Date(Date.now() + 60000).toISOString(), status: 'active', builderPlacementId: 'p' } }); m.db = f.db; store = f.store; m.context.mockResolvedValue({ valid: true, profile: { permissions: { allowSaveDraft: true } } }); });
it('rejects missing/wrong capabilities and expired sessions for all legacy mutations', async () => {
  const a = app();
  for (const action of ['draft', 'cart', 'buy']) {
    expect((await request(a).post(`/public/embed/session/s/${action}`).send({})).status).toBe(401);
    expect((await request(a).post(`/public/embed/session/s/${action}`).set('Authorization', `Bearer ${'b'.repeat(32)}`).send({})).status).toBe(401);
  }
  store.get(`${BUILDER_SESSIONS_COLLECTION}/s`).expiresAt = '2000-01-01';
  for (const action of ['draft', 'cart', 'buy']) expect((await request(a).post(`/public/embed/session/s/${action}`).set('Authorization', auth).send({})).status).toBe(410);
  expect(m.context).not.toHaveBeenCalled();
});
it('writes valid drafts atomically and rejects reused terminal state', async () => {
  const a = app(); expect((await request(a).post('/public/embed/session/s/draft').set('Authorization', auth).send({ draftPayload: { title: 'Mine' } })).status).toBe(200);
  const req = { headers: { authorization: auth } } as any;
  await mutateEmbedSession('s', req, ['active'], { status: 'checkout_starting' });
  await expect(mutateEmbedSession('s', req, ['active'], { status: 'checkout_starting' })).rejects.toMatchObject({ status: 409 });
  expect(() => assertEmbedSession({ anonToken: token, expiresAt: 'invalid', status: 'active' }, req, ['active'])).toThrow('expired');
});
it('rejects malformed/oversized QR requests and emits a real bounded PNG', async () => {
  const a = app();
  for (const size of ['Infinity', '1e9', '-1', '0', '63', '2049', '200junk', '200.5']) expect((await request(a).get('/qr/image').query({ data: 'hello', size })).status).toBe(400);
  expect((await request(a).get('/qr/image').query({ data: 'x'.repeat(2049) })).status).toBe(400);
  expect((await request(a).get('/qr/image?data[]=hello')).status).toBe(400);
  const result = await request(a).get('/qr/image').query({ data: 'https://example.invalid', size: 200 });
  expect(result.status).toBe(200); expect(result.headers['content-type']).toContain('image/png'); expect(result.body.readUInt32BE(16)).toBe(200);
});
it('uses revocation checking for ordinary and member adapters and rejects disabled/revoked accounts', async () => {
  const req = { headers: { authorization: 'Bearer valid' } } as any;
  expect(await verifyAuth(req)).toEqual({ uid: 'owner' }); expect(await verifyMemberAuthCF(req, 'owner')).toMatchObject({ authorized: true });
  for (const code of ['auth/id-token-revoked', 'auth/user-disabled']) {
    m.verify.mockRejectedValue(Object.assign(new Error(code), { code }));
    expect(await verifyAuth(req)).toBeNull(); expect(await verifyMemberAuthCF(req, 'owner')).toMatchObject({ authorized: false });
    expect((await request(app()).put('/members/owner/social-handles').set('Authorization', 'Bearer valid').send({ socialHandles: {} })).status).toBe(401);
  }
  expect(m.verify.mock.calls.every(args => args[1] === true)).toBe(true);
});

it('reserves normalized creator addresses and refuses historical collisions', async () => {
 const run = m.db.runTransaction; let tail = Promise.resolve(); m.db.runTransaction = (fn: any) => { const r = tail.then(() => run(fn)); tail = r.catch(() => {}); return r; };
 store.set('member_profiles/owner', { memberSince: '2020-01-01', stripeAccountId: 'protected' });
 const results = await Promise.allSettled([saveCreatorProfile('owner', { creatorSlug: ' My-Shop ' }), saveCreatorProfile('other', { creatorSlug: 'my-shop' })]);
 expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
 expect(store.get('member_profiles/owner')).toMatchObject({ creatorSlug: 'my-shop', memberSince: '2020-01-01', stripeAccountId: 'protected' });
 await saveCreatorProfile('owner', { creatorSlug: 'new-shop' }); expect(store.has('creatorSlugs/my-shop')).toBe(false);
 store.set('member_profiles/legacy1', { creatorSlug: 'Duplicate' }); store.set('member_profiles/legacy2', { creatorSlug: 'duplicate' });
 await expect(findCreatorProfile('DUPLICATE')).rejects.toMatchObject({ status: 409 });
 await expect(saveCreatorProfile('other', { creatorSlug: 'DUPLICATE' })).rejects.toMatchObject({ status: 409 });
});
it('uses contact email and reports delivery only after provider acceptance', async () => {
 store.set('member_profiles/owner', { contactEmail: 'contact@example.test', email: 'old@example.test', fullName: '<Creator>' });
 store.set('member_social_schedule/due', { memberId: 'owner', isActive: true, nextPostAt: '2000-01-01', packetId: 'p', platforms: [] });
 m.send.mockResolvedValue({ error: { message: 'Rejected' }, data: null });
 const send = () => request(app()).post('/members/owner/social-schedule/send-reminders').set('Authorization', 'Bearer valid');
 expect((await send()).status).toBe(502); expect(m.send.mock.calls[0][0].to).toBe('contact@example.test'); expect(m.send.mock.calls[0][0].html).toContain('&lt;Creator>');
 m.send.mockResolvedValue({ data: { id: 'accepted' }, error: null }); expect((await send()).body.sent).toBe(true);
});
