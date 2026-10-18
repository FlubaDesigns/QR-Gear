import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) } }));
import { prepareAdminCompose } from '../admin-compose';
import { resolveDynamicsInstance } from '../qr-dynamics';
import { QR_DYNAMICS_INSTANCES_COLLECTION as C } from '../../constants';
let store: Map<string, any>;
beforeEach(() => { const f = database({
 'productPackets/build': { builderSnapshot: { qrConfig: { qrProductState: 'qr_compose' }, graphics: { content: { composeMode: 'auto-rotate', composeHostingTerm: '1-year', composeItems: [{ packetId: 'canvas', durationSeconds: 60, order: 0 }, { packetId: 'play', durationSeconds: 60, order: 1 }] } } } },
 'productPackets/canvas': { status: 'published', qrProductState: 'qr_canvas', landingPageSlug: 'canvas' },
 'productPackets/play': { status: 'published', qrProductState: 'qr_play', landingPageSlug: 'play' },
 }); m.db = f.db; store = f.store; });
it('prepares one-based canonical slots, keeps drafts unscannable, and resolves after catalog binding', async () => {
 const prepared = await prepareAdminCompose('admin', 'build');
 const dynamic = store.get(`${C}/${prepared.instanceId}`); expect(dynamic.slots.map((x: any) => x.order)).toEqual([1,2]);
 await expect(resolveDynamicsInstance(prepared.instanceId)).rejects.toMatchObject({ status: 404 });
 const qrg = 'QRG-11111-I-000001'; Object.assign(dynamic, { status: 'active', qrgBaseCode: qrg });
 Object.assign(store.get('productPackets/build'), { ownerType: 'admin', ownerInstanceId: 'i', qrgBaseCode: qrg });
 store.set('admin_catalog_instances/i', { status: 'active', currentPacketId: 'build', qrgBaseCode: qrg });
 expect((await resolveDynamicsInstance(prepared.instanceId)).targets).toEqual(['/m/canvas', '/m/play']);
});
it('rejects unpublished content and disconnected legacy publish payloads', async () => {
 store.get('productPackets/canvas').status = 'draft'; await expect(prepareAdminCompose('admin', 'build')).rejects.toThrow('published');
 await expect(prepareAdminCompose('admin', undefined as any)).rejects.toThrow('physical packet');
});
