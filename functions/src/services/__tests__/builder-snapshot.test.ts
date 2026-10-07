import { describe, it, expect } from 'vitest';
import { buildWorkingSnapshot, packetBuildFields, productGraphicOptions, requireBuilderSnapshot } from '../../../../shared/builderSnapshot';
import { readGeneratedBuild, existingBuildInstance } from '../build-session-state';

export function fixture() {
  return buildWorkingSnapshot({
    content: { graphicLayoutMode: 'freeform', url: 'https://example.test/destination', title: 'Offer',
      qrPositionX: 20, qrPositionY: 80, qrSizePercent: 40, areaImageUrl: 'https://example.test/image.png',
      areaImageMode: 'behind-qr', areaImageOffsetX: 30, areaImageOffsetY: 70, areaImageScale: 65,
      headerStyle: { enabled: true, text: 'Exact words', fontSize: '28', color: '#123456' },
      playMediaFile: { name: 'local.mp4' }, playMediaPreview: 'blob:local' },
    selectedProduct: { docId: 'qrg_11001', blueprintId: 12, images: [] },
    selectedColor: { name: 'Black', hex: '#000000' }, qrProductState: 'qr_basics',
    selectedPlacements: ['back'], placementConfig: { back: 'qr' }, placementMethods: { back: 'dtf' }, placementSizes: { back: 'small' },
    providerLayout: { dimensions: { widthPx: 3600, heightPx: 4200 } }, fulfillmentProvider: 'printify',
    adminCatalogTitle: 'Custom title', productDescription: 'Custom description',
  }, { selectedRole: 'internal', selectedStore: { id: 'store' }, selectedChannel: { id: 'channel' }, selectedCollection: { name: 'Collection' } });
}
function memoryDb(seed: Record<string, any>) {
  const store = new Map(Object.entries(seed));
  const ref = (path: string): any => ({ path, id: path.split('/').pop(), get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    update: async (patch: any) => { const data = structuredClone(store.get(path)); for (const [field, value] of Object.entries(patch)) { const keys = field.split('.'); let target = data; for (const key of keys.slice(0, -1)) target = target[key] ||= {}; target[keys[keys.length - 1]] = value; } store.set(path, data); } });
  const db = { collection: (name: string): any => ({ doc: (id: string) => ref(`${name}/${id}`),
    add: async (data: any) => { const r = ref(`${name}/new`); store.set(r.path, data); return r; },
    where: (field: string, op: string, value: any) => ({ get: async () => ({ docs: [...store.entries()].filter(([key, data]) => {
      const v = field.split('.').reduce((a, k) => a?.[k], data); return key.startsWith(name + '/') && (op === 'array-contains' ? v?.includes(value) : v === value);
    }).map(([key, data]) => ({ ref: ref(key), data: () => data })) }) }),
  }), runTransaction: async (fn: any) => fn({ get: (r: any) => r.get(), update: (r: any, data: any) => r.update(data), delete: (r: any) => store.delete(r.path) }) };
  return { db, store };
}
describe('builder snapshot handoffs', () => {
  it('preserves inputs without browser-only File/preview data', () => {
    const s = requireBuilderSnapshot(fixture());
    expect(s.graphics.content).not.toHaveProperty('playMediaFile');
    expect(s.graphics.content).not.toHaveProperty('playMediaPreview');
    expect(s.layoutConfig).toMatchObject({ selectedPlacements: ['back'], placementMethods: { back: 'dtf' } });
    expect(s.bldDraft).toMatchObject({ context: 'S', layoutMode: 'P' });
  });
  it('uses identical geometry for packet persistence and rendering', () => {
    const s = fixture(), packet = packetBuildFields(s), render = productGraphicOptions(s, 'https://example.test/destination');
    for (const key of ['graphicLayoutMode', 'qrSizePercent', 'qrPositionX', 'qrPositionY', 'areaImageOffsetX', 'areaImageOffsetY', 'areaImageScale', 'headerStyle', 'providerLayout']) expect(render[key]).toEqual(packet[key]);
    expect(render.placement).toBe('back'); expect(packet.placements).toEqual(['back']);
    expect(packet.builderSnapshot.graphics.content.headerStyle.text).toBe('Exact words');
  });
  it('derives BLD from inputs and rejects incomplete layout before writes', () => {
    const s = fixture(); s.bldDraft = { context: 'U', layoutMode: 'D', instances: [] };
    expect(requireBuilderSnapshot(s).bldDraft.layoutMode).toBe('P');
    s.graphics.content.graphicLayoutMode = '';
    expect(() => requireBuilderSnapshot(s)).toThrow('layoutMode');
  });
  it('commits the rendered snapshot, not newer draft edits, and checks its session', async () => {
    const { db } = memoryDb({ 'productPackets/p': { buildSessionId: 's', builderSnapshot: fixture() } });
    const session = { id: 's', sourceMasterId: 'qrg_11001', generated: { packetId: 'p' }, working: { title: 'Later edits' } };
    expect((await readGeneratedBuild(db, session)).title).toBe('Custom title');
    await expect(readGeneratedBuild(db, { ...session, id: 'other' })).rejects.toThrow('different build session');
  });
  it('resolves an existing instance without changing its identity', async () => {
    const original = { sourceMasterId: 'qrg_11001', sourceSessionId: 's', qrgBaseCode: 'QRG-11001-I-000001', createdAt: 'original' };
    const { db, store } = memoryDb({ 'admin_catalog_instances/item': original });
    const session = { id: 's', sourceMasterId: 'qrg_11001', committedInstanceId: 'item' };
    expect(await existingBuildInstance(db, session)).toEqual(original);

  });

});
