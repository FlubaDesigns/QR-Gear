import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
import { MEMBER_PACKETS_COLLECTION } from '../../constants';
const m = vi.hoisted(() => ({ db: null as any, uid: 'owner' }));
vi.mock('../../core', () => ({
  db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) },
  admin: { auth: () => ({ verifyIdToken: async () => ({ uid: m.uid }) }), firestore: { FieldValue: { serverTimestamp: () => 'now' } } },
  docToObject: (d: any) => ({ id: d.id, ...d.data() }), docsToArray: (s: any) => s.docs.map((d: any) => ({ id: d.id, ...d.data() })),
}));
import { register as designs } from '../../routes/designs';
import { registerMembersLibraryRoutes as library } from '../../routes/members-library';
import { register as dynamicPages } from '../../routes/am-sync';
let store: Map<string, any>;
const app = () => { const a = express(); a.use(express.json()); designs(a); library(a); dynamicPages(a); return a; };
beforeEach(() => { m.uid = 'owner'; const fixture = database({
  'customDesigns/d': { userId: 'owner', projectName: 'Mine', publishStatus: 'draft' },
  'users/other': {}, 'users/admin': { isAdmin: true },
  [`${MEMBER_PACKETS_COLLECTION}/p`]: { memberId: 'owner', background: { url: 'art' }, status: 'draft' },
  'memberTemplates/t': { memberId: 'owner', packetId: 'p' }, 'channels/c': { ownerId: 'owner' },
  'dynamic_pages/page': { userId: 'owner', title: 'Private page', slug: 'public', isActive: true },
  'dynamic_page_assets/own': { pageId: 'page', title: 'Mine' }, 'dynamic_page_assets/foreign': { pageId: 'another' },
}); m.db = fixture.db; store = fixture.store; });

it('QRG-005 blocks anonymous and foreign reads, updates and deletion without changing a design', async () => {
  const a = app(); expect((await request(a).get('/designs/d')).status).toBe(401); m.uid = 'other';
  for (const method of ['get', 'put', 'delete'] as const) expect((await request(a)[method]('/designs/d').set('Authorization', 'Bearer valid').send({ projectName: 'Stolen', userId: 'other' })).status).toBe(403);
  expect(store.get('customDesigns/d')).toEqual({ userId: 'owner', projectName: 'Mine', publishStatus: 'draft' });
});
it('QRG-009 denies every foreign page or asset management operation', async () => {
  m.uid = 'other'; const before = JSON.stringify([...store]);
  for (const [method, path] of [['get', '/dynamic-pages/page'], ['put', '/dynamic-pages/page'], ['delete', '/dynamic-pages/page'], ['get', '/dynamic-pages/page/assets'], ['post', '/dynamic-pages/page/assets'], ['post', '/dynamic-pages/page/set-active']] as const) {
    expect((await request(app())[method](path).set('Authorization', 'Bearer valid').send({ assetId: 'own', title: 'Stolen', userId: 'other' })).status).toBe(403);
    expect(JSON.stringify([...store])).toBe(before);
  }
});
it('QRG-009 keeps owner and parent immutable and rejects selecting another page asset', async () => {
  const a = app();
  expect((await request(a).put('/dynamic-pages/page').set('Authorization', 'Bearer valid').send({ title: 'Changed', userId: 'other', slug: 'stolen', hostingTierId: 'free' })).status).toBe(200);
  expect(store.get('dynamic_pages/page')).toMatchObject({ userId: 'owner', title: 'Changed', slug: 'public' }); expect(store.get('dynamic_pages/page').hostingTierId).toBeUndefined();
  expect((await request(a).post('/dynamic-pages/page/set-active').set('Authorization', 'Bearer valid').send({ assetId: 'foreign' })).status).toBe(403);
  expect((await request(a).put('/dynamic-pages/page').set('Authorization', 'Bearer valid').send({ activeAssetId: 'foreign' })).status).toBe(403);
  expect((await request(a).post('/dynamic-pages/page/set-active').set('Authorization', 'Bearer valid').send({ assetId: 'own' })).status).toBe(200);
  const saved = await request(a).post('/dynamic-pages/page/assets').set('Authorization', 'Bearer valid').send({ pageId: 'another', userId: 'other', title: 'New' });
  expect(saved.status).toBe(200); expect(saved.body.pageId).toBe('page'); expect(saved.body.userId).toBeUndefined();
  const publicPage = await request(a).get('/dynamic/public'); expect(publicPage.status).toBe(200); expect(publicPage.body.userId).toBeUndefined();
});
it('QRG-005 preserves legitimate edits while ignoring ownership, publication and arbitrary fields', async () => {
  const a = app();
  expect((await request(a).put('/designs/d').set('Authorization', 'Bearer valid').send({ projectName: 'Changed', userId: 'other', ownerUserId: 'other', publishStatus: 'published', arbitrary: 'no' })).status).toBe(200);
  expect(store.get('customDesigns/d')).toEqual({ userId: 'owner', projectName: 'Changed', publishStatus: 'draft', updatedAt: 'now' });
  expect((await request(a).get('/designs/d').set('Authorization', 'Bearer valid')).body.projectName).toBe('Changed');
  expect((await request(a).delete('/designs/d').set('Authorization', 'Bearer valid')).status).toBe(200); expect(store.has('customDesigns/d')).toBe(false);
});
it('QRG-005 permits the existing admin policy and reports missing objects', async () => {
  m.uid = 'admin'; const a = app();
  expect((await request(a).get('/designs/d').set('Authorization', 'Bearer valid')).status).toBe(200);
  expect((await request(a).put('/designs/missing').set('Authorization', 'Bearer valid').send({ projectName: 'x' })).status).toBe(404);
});
it('QRG-006 denies copying or publishing a foreign packet with no partial writes', async () => {
  m.uid = 'other'; const before = JSON.stringify([...store]);
  for (const route of ['/member/templates/save', '/member/library-links']) {
    expect((await request(app()).post(route).set('Authorization', 'Bearer valid').send({ memberId: 'other', packetId: 'p' })).status).toBe(403);
    expect(JSON.stringify([...store])).toBe(before);
  }
});
it('QRG-006 rejects foreign templates, wrong-product templates and foreign channels atomically', async () => {
  for (const patch of [{ memberId: 'other', packetId: 'p' }, { memberId: 'owner', packetId: 'different' }]) {
    store.set('memberTemplates/t', patch);
    expect((await request(app()).post('/member/library-links').set('Authorization', 'Bearer valid').send({ memberId: 'owner', packetId: 'p', templateId: 't' })).status).toBe(403);
  }
  store.set('channels/c', { ownerId: 'other' });
  expect((await request(app()).post('/member/library-links').set('Authorization', 'Bearer valid').send({ memberId: 'owner', packetId: 'p', channelId: 'c' })).status).toBe(403);
  expect(store.get(`${MEMBER_PACKETS_COLLECTION}/p`).status).toBe('draft'); expect([...store.keys()].some(k => k.startsWith('memberLibraryLinks/'))).toBe(false);
});
it('QRG-006 saves an owned template and publishes related owned records together', async () => {
  const a = app(); const saved = await request(a).post('/member/templates/save').set('Authorization', 'Bearer valid').send({ memberId: 'owner', packetId: 'p' });
  expect(saved.status).toBe(200); expect(store.get(`${MEMBER_PACKETS_COLLECTION}/p`).templateId).toBe(saved.body.templateId);
  const linked = await request(a).post('/member/library-links').set('Authorization', 'Bearer valid').send({ memberId: 'owner', packetId: 'p', templateId: saved.body.templateId, channelId: 'c' });
  expect(linked.status).toBe(200); expect(store.get(`${MEMBER_PACKETS_COLLECTION}/p`).status).toBe('published'); expect(store.has(`memberLibraryLinks/${linked.body.libraryLinkId}`)).toBe(true);
});
