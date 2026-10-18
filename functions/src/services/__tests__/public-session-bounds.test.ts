import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, verify: vi.fn(), context: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, admin: { auth: () => ({ verifyIdToken: m.verify }), firestore: { FieldValue: { serverTimestamp: () => 'now' } } } }));
vi.mock('../embed-validation', () => ({ validateEmbedContext: m.context, DEFAULT_BUILDER_PERMISSIONS: { allowSaveDraft: true } }));
import { registerExternalSitesPublicRoutes } from '../../routes/external-sites-public';
import { register as utility } from '../../routes/am-utility';
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
