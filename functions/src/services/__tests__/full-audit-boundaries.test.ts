import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, uid: 'other', sign: vi.fn(), generate: vi.fn() }));
vi.mock('../../core', () => ({
  db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) },
  admin: { auth: () => ({ verifyIdToken: async () => ({ uid: m.uid }) }), storage: () => ({ bucket: () => ({ name: 'fixture', file: (path: string) => ({ getSignedUrl: (...args: any[]) => m.sign(path, ...args) }) }) }) },
  escapeHtml: (v: string) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!),
  docToObject: (d: any) => ({ id: d.id, ...d.data() }),
  docsToArray: (s: any) => s.docs.map((d: any) => ({ id: d.id, ...d.data() })),
}));
vi.mock('../mockup-generator', () => ({ generateMockupFromPrintful: m.generate }));
import { register as referrals } from '../../routes/referral';
import { register as images } from '../../routes/images';
import { register as seo } from '../../routes/seo';
import { register as mockups } from '../../routes/mockup-routes';
import { register as utilities } from '../../routes/am-utility';
import { register as dynamics } from '../../routes/dynamics';
import { register as catalog } from '../../routes/am-sync';
import { register as core } from '../../routes/core-routes';
import { register as widget } from '../../routes/widget';
import { registerMembersLibraryRoutes as members } from '../../routes/members-library';
import { MEMBER_PACKETS_COLLECTION, MOSAICS_COLLECTION } from '../../constants';
let store: Map<string, any>;
const app = () => { const a = express(); a.use(express.json()); [referrals, images, seo, mockups, utilities, dynamics, catalog, core, widget, members].forEach(register => register(a)); return a; };
beforeEach(() => {
  vi.clearAllMocks(); m.uid = 'other'; m.sign.mockResolvedValue(['https://storage.invalid/signed']);
  const f = database({
    'users/other': {}, 'users/admin': { isAdmin: true },
    'referrals/r': { buyerKey: 'victim', referrerId: 'attacker', buyerEmail: 'private@example.invalid' },
    [`${MEMBER_PACKETS_COLLECTION}/draft`]: { status: 'draft', memberId: 'owner', title: 'Private draft', shareCardUrl: 'https://files/image.png' },
    [`${MEMBER_PACKETS_COLLECTION}/shared`]: { status: 'published', memberId: 'owner', shareCardUrl: 'https://files/image.png"><script>alert(1)</script>' },
    'hosted_images/live': { userId: 'owner', storageUrl: 'private-path', isActive: true, title: 'Shared', publicUrl: 'https://files/shared.png', createdAt: '2026-10-18T00:00:00.000Z', futurePrivateField: 'secret' },
    'hosted_images/removed': { isActive: false, publicUrl: 'https://files/removed.png' },
    'products/custom_p': { isEnabled: true, defaultColor: 'White', mockupsByColor: { Black: { front: 'https://files/black.png' } } },
    'qrDynamicsSurfaces/s': { isEnabled: true, storeId: 'store', channelId: 'channel', collectionName: 'collection' },
    'storeProductLinks/hidden': { storeId: 'store', channel: 'channel', collection: 'collection', isVisible: false, packetId: 'private' },
    'productPackets/private': { status: 'draft' },
  }); m.db = f.db; store = f.store;
});
it('retires unverified referral capture and protects private referral lookups', async () => {
  const a = app();
  expect((await request(a).post('/public/referral/capture').send({ referrerId: 'attacker', buyerUserId: 'victim' })).status).toBe(410);
  expect((await request(a).get('/public/referral/lookup?buyerUserId=victim')).status).toBe(401);
  expect((await request(a).get('/public/referral/lookup?buyerUserId=victim').set('Authorization', 'Bearer valid')).status).toBe(403);
  expect(store.get('referrals/r').referrerId).toBe('attacker');
});
it('withholds drafts from member aliases and crawler metadata', async () => {
  const a = app();
  expect((await request(a).get('/public/member-packet/draft')).status).toBe(404);
  expect((await request(a).get('/p/draft').set('User-Agent', 'facebookexternalhit')).status).toBe(404);
  expect((await request(a).get('/public/member-packet/shared')).status).toBe(200);
});
it('escapes stored image URLs in social metadata', async () => {
  const r = await request(app()).get('/p/shared').set('User-Agent', 'facebookexternalhit');
  expect(r.status).toBe(200); expect(r.text).not.toContain('<script>'); expect(r.text).toContain('&quot;');
});
it('does not publish a member projection whose production packet is unpublished', async () => {
  store.get(`${MEMBER_PACKETS_COLLECTION}/shared`).productionPacketId = 'private';
  const a = app();
  expect((await request(a).get('/public/member-packet/shared')).status).toBe(404);
  expect((await request(a).get('/p/shared').set('User-Agent', 'Twitterbot')).status).toBe(404);
});
it('keeps public images useful without exposing ownership and private storage metadata', async () => {
  const a = app();
  for (const path of ['/images/live', '/images/info/live']) {
    const r = await request(a).get(path); expect(r.status).toBe(200);
    expect(r.body.publicUrl).toBe('https://files/shared.png');
    expect(r.body).not.toHaveProperty('userId'); expect(r.body).not.toHaveProperty('storageUrl'); expect(r.body).not.toHaveProperty('futurePrivateField');
  }
  expect((await request(a).get('/images/info/removed')).status).toBe(404);
  expect((await request(a).get('/images/user/owner')).status).toBe(401);
  expect((await request(a).get('/images/user/owner').set('Authorization', 'Bearer valid')).status).toBe(403);
  m.uid = 'owner'; expect((await request(a).get('/images/user/owner').set('Authorization', 'Bearer valid')).status).toBe(200);
});
it('returns the upload contract consumed by the client and prevents same-name collisions', async () => {
  const a = app(), body = { name: 'logo.png', size: 123, contentType: 'image/png' };
  const first = await request(a).post('/uploads/request-url').set('Authorization', 'Bearer valid').send(body);
  const second = await request(a).post('/uploads/request-url').set('Authorization', 'Bearer valid').send(body);
  expect(first.status).toBe(200); expect(first.body).toMatchObject({ uploadURL: 'https://storage.invalid/signed', metadata: body });
  expect(first.body.objectPath).toMatch(/^uploads\/other\//); expect(first.body.objectPath).not.toBe(second.body.objectPath);
  expect((await request(a).post('/uploads/request-url').set('Authorization', 'Bearer valid').send({ ...body, size: 30 * 1024 * 1024 })).status).toBe(400);
});
it('blocks non-admin access to legacy mockup mutations and job/cache diagnostics', async () => {
  const a = app();
  for (const path of ['/mockups/cached/1/2', '/mockup-jobs/stats', '/mockup-jobs/product/p', '/mockup-jobs/job', '/store-product-links', '/templates']) {
    expect((await request(a).get(path)).status, path).toBe(401);
    expect((await request(a).get(path).set('Authorization', 'Bearer valid')).status, path).toBe(403);
  }
  expect((await request(a).post('/storefront/generate-mockup').send({ productId: 'p', color: 'Black' })).status).toBe(401);
  expect((await request(a).post('/mockups/get-or-generate').send({})).status).toBe(401);
  for (const path of ['/public/generate-mockup', '/public/generate-product-graphic']) {
    expect((await request(a).post(path).send({})).status).toBe(401);
    expect((await request(a).post(path).set('Authorization', 'Bearer valid').send({})).status).toBe(403);
  }
  expect(store.get('products/custom_p').defaultColor).toBe('White'); expect(m.generate).not.toHaveBeenCalled();
  m.uid = 'admin';
  expect((await request(a).get('/mockups/cached/1/2').set('Authorization', 'Bearer valid')).status).toBe(200);
});
it('excludes hidden links and unpublished packets from public rotation', async () => {
  const a = app(); let r = await request(a).get('/public/dynamics/resolve/s');
  expect(r.status).toBe(200); expect(r.body.activeItem).toBeNull();
  store.get('storeProductLinks/hidden').isVisible = true;
  r = await request(a).get('/public/dynamics/resolve/s'); expect(r.body.activeItem).toBeNull();
  store.get('productPackets/private').status = 'published';
  r = await request(a).get('/public/dynamics/resolve/s'); expect(r.body.activeItem.packetId).toBe('private');
});
it('hides disabled legacy products and draft widget mosaics while preserving published mosaics', async () => {
  store.set('products/disabled', { isEnabled: false, isVisible: true });
  store.set(`${MOSAICS_COLLECTION}/m`, { status: 'draft', storeId: 'store', entries: [] });
  const a = app();
  expect((await request(a).get('/products/disabled')).status).toBe(404);
  expect((await request(a).get('/store/products')).body).toEqual([]);
  for (const path of ['/widget/mosaics/m', '/widget/mosaics/m/moments']) expect((await request(a).get(path)).status).toBe(404);
  expect((await request(a).get('/widget/stores/store/mosaics')).body.mosaics).toEqual([]);
  for (const status of ['active', 'published']) {
    store.get(`${MOSAICS_COLLECTION}/m`).status = status;
    expect((await request(a).get('/widget/mosaics/m')).status).toBe(200);
    expect((await request(a).get('/widget/stores/store/mosaics')).body.mosaics).toHaveLength(1);
  }
});
