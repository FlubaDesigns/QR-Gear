import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (...args: any[]) => m.db.collection(...args) }, admin: {} }));
import { freezeProductionSource, readOrderProductionSource } from '../dynamics-order';
let store: Map<string, any>;
const packet = () => ({ assemblyId: 'ASM-000001', bldId: 'BLD-SZ10-001', qrContent: 'https://example.invalid/original',
  placementGraphicUrls: { front: 'https://example.invalid/original.png' }, placementGrfIds: { front: 'GRF-11442-000001' },
  builderSnapshot: { graphics: { content: { title: 'Original' } }, metadata: { selectedProductDocId: 'qrg_11111', selectedStore: { id: 'before' } } }, storeId: 'before' });
beforeEach(() => { const f = database(); m.db = f.db; store = f.store; });
it('retains paid artwork and layout after editing, moving or deleting the live source', async () => {
  const original = packet(), frozen = freezeProductionSource(original, '11111');
  store.set('orderProductionSources/o_0', { ...frozen, orderId: 'o' });
  const item = { orderId: 'o', packetId: 'p', qrExperience: { version: 2, sourceHash: frozen.sourceHash } };
  original.placementGraphicUrls.front = 'https://example.invalid/edited.png'; original.builderSnapshot.graphics.content.title = 'Changed'; original.storeId = 'after';
  store.set('productPackets/p', original);
  expect((await readOrderProductionSource('o_0', item)).source.placementGraphicUrls.front).toBe('https://example.invalid/original.png');
  store.delete('productPackets/p'); expect((await readOrderProductionSource('o_0', item)).source.builderSnapshot.graphics.content.title).toBe('Original');
});
it('excludes catalog folder metadata from new production identities', () => {
  const before = freezeProductionSource(packet(), '11111'), moved = packet(); moved.storeId = 'after'; moved.builderSnapshot.metadata.selectedStore.id = 'after';
  expect(freezeProductionSource(moved, '11111').sourceHash).toBe(before.sourceHash);
});
it('fails closed on a missing, tampered or foreign frozen source without substituting live artwork', async () => {
  const frozen = freezeProductionSource(packet(), '11111'), item = { orderId: 'o', packetId: 'p', qrExperience: { version: 2, sourceHash: frozen.sourceHash } };
  store.set('productPackets/p', packet()); await expect(readOrderProductionSource('o_0', item)).rejects.toThrow('snapshot');
  store.set('orderProductionSources/o_0', { ...frozen, orderId: 'foreign' }); await expect(readOrderProductionSource('o_0', item)).rejects.toThrow('snapshot');
  store.get('orderProductionSources/o_0').orderId = 'o'; store.get('orderProductionSources/o_0').packet.qrContent = 'changed';
  await expect(readOrderProductionSource('o_0', item)).rejects.toThrow('snapshot');
});
