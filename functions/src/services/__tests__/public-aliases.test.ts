import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, uid: 'other', generate: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, admin: { auth: () => ({ verifyIdToken: async () => ({ uid: m.uid }) }), firestore: { FieldValue: { serverTimestamp: () => 'now' } } } }));
vi.mock('../mockup-generator', () => ({ generateMockupFromPrintful: m.generate }));
import { register as packetRoutes } from '../../routes/pp-pricing-packets';
import { register as storeRoutes } from '../../routes/store-files';
import { register as utilityRoutes } from '../../routes/am-utility';
import { isPublicPacket } from '../publication';
let store: Map<string, any>;
const app = () => { const a = express(); a.use(express.json()); packetRoutes(a); storeRoutes(a); utilityRoutes(a); return a; };
beforeEach(() => { vi.clearAllMocks(); m.uid = 'other'; const fixture = database({
  'productPackets/p': { ownerType: 'admin', ownerInstanceId: 'i', qrgBaseCode: 'q', status: 'ready', playMediaUrl: 'https://example.invalid/video.mp4', privateField: 'secret' },
  'admin_catalog_instances/i': { status: 'active', currentPacketId: 'p', qrgBaseCode: 'q' },
  'custom_designs/legacy': { userId: 'owner', secret: true }, 'users/other': {},
}); m.db = fixture.db; store = fixture.store; });
it('rejects unpublished and superseded packets and returns only public play fields', async () => {
  const a = app(); const result = await request(a).get('/public/packets/p');
  expect(result.status).toBe(200); expect(Object.keys(result.body.packet).sort()).toEqual(['id', 'playMediaType', 'playMediaUrl', 'productName']);
  store.get('productPackets/p').status = 'building'; expect((await request(a).get('/public/packets/p')).status).toBe(404);
  store.get('productPackets/p').status = 'ready'; store.get('admin_catalog_instances/i').currentPacketId = 'new'; expect((await request(a).get('/public/packets/p')).status).toBe(404);
});
it('denies hidden/inactive/archived/draft aliases before provider generation', async () => {
  const a = app();
  for (const patch of [{ isVisible: false }, { isActive: false }, { status: 'archived' }, { status: 'draft' }]) {
    store.set('admin_catalog_instances/i', { status: 'active', currentPacketId: 'p', qrgBaseCode: 'q', ...patch });
    expect((await request(a).get('/store/product/i')).status).toBe(404);
    expect((await request(a).post('/store/product/i/mockup-for-color').send({ colorName: 'Black' })).status).toBe(404);
  } expect(m.generate).not.toHaveBeenCalled();
});
it('requires a published member packet bound to the exact production packet', async () => {
  const packet = { status: 'published', memberId: 'owner', memberPacketId: 'm' }; expect(await isPublicPacket('p', packet)).toBe(false);
  store.set('member_packets/m', { status: 'published', memberId: 'owner', productionPacketId: 'p' }); expect(await isPublicPacket('p', packet)).toBe(true);
  store.get('member_packets/m').productionPacketId = 'replacement'; expect(await isPublicPacket('p', packet)).toBe(false);
});
it('protects the retained legacy design alias', async () => {
  const a = app(); expect((await request(a).get('/customs/legacy')).status).toBe(401);
  expect((await request(a).get('/customs/legacy').set('Authorization', 'Bearer valid')).status).toBe(403);
  m.uid = 'owner'; expect((await request(a).get('/customs/legacy').set('Authorization', 'Bearer valid')).status).toBe(200);
});
