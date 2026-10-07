import { buildWorkingSnapshot } from '../../../../shared/builderSnapshot';
export function database(seed: Record<string, any> = {}) {
  const store = new Map(Object.entries(structuredClone(seed))); let serial = 0;
  const patch = (path: string, data: any) => {
    const next = structuredClone(store.get(path) || {});
    for (const [field, value] of Object.entries(data)) {
      const keys = field.split('.'); let target = next;
      for (const key of keys.slice(0, -1)) target = target[key] ||= {};
      target[keys[keys.length - 1]] = structuredClone(value);
    } store.set(path, next);
  };
  const ref = (path: string): any => ({ path, id: path.split('/').pop(), collection: (name: string) => query(`${path}/${name}`),
    get: async () => ({ id: path.split('/').pop(), ref: ref(path), exists: store.has(path), data: () => structuredClone(store.get(path)) }),
    update: async (data: any) => { if (!store.has(path)) throw new Error('missing document'); patch(path, data); },
    set: async (data: any) => store.set(path, structuredClone(data)), delete: async () => store.delete(path),
  });
  const query = (name: string, filters: any[] = []): any => ({
    doc: (id: string = `auto-${++serial}`) => ref(`${name}/${id}`),
    where: (field: string, op: string, value: any) => query(name, [...filters, [field, op, value]]),
    orderBy: () => query(name, filters), limit: () => query(name, filters),
    get: async () => {
      const paths = Array.from(store.keys()).filter(path => path.startsWith(`${name}/`) && path.split('/').length === name.split('/').length + 1 && filters.every(([field, op, value]) => {
        const actual = field.split('.').reduce((v: any, k: string) => v?.[k], store.get(path));
        return op === 'array-contains' ? actual?.includes(value) : actual === value;
      }));
      const docs = await Promise.all(paths.map(path => ref(path).get())); return { docs, empty: docs.length === 0, size: docs.length };
    },
  });
  const db: any = { collection: query, runTransaction: async (fn: any) => {
    const writes: Array<() => void> = []; let writing = false;
    const result = await fn({ get: (r: any) => { if (writing) throw new Error('Firestore reads after writes'); return r.get(); },
      set: (r: any, data: any) => { writing = true; writes.push(() => patch(r.path, data)); },
      update: (r: any, data: any) => { writing = true; if (!store.has(r.path)) throw new Error('missing update'); writes.push(() => patch(r.path, data)); },
      create: (r: any, data: any) => { writing = true; if (store.has(r.path)) throw new Error('collision'); writes.push(() => store.set(r.path, structuredClone(data))); },
      delete: (r: any) => { writing = true; writes.push(() => store.delete(r.path)); },
    }); writes.forEach(fn => fn()); return result;
  } };
  return { db, store };
}
export function legacyFixture() {
  const snapshot = buildWorkingSnapshot({ content: { graphicLayoutMode: 'zone', qrSizePercent: 50,
    footerStyle: { enabled: true, text: 'ARMY', color: '#fff' }, subBottomStyle: { enabled: true, text: 'EST. 1775' },
    landingTextBlocks: Array.from({ length: 6 }, (_, i) => ({ enabled: true, text: `Website text ${i}` })) },
    loadedBackground: { url: 'https://files/website.png' }, selectedProduct: { docId: 'master' },
    selectedPlacements: ['front'], placementConfig: {}, placementSizes: {}, placementMethods: {}, qrProductState: 'qr_basics',
  }, { selectedRole: null, selectedStore: null, selectedChannel: null, selectedCollection: null });
  const bldId = 'BLD-SZ10-004', assemblyId = 'ASM-000002';
  const { db, store } = database({
    'master_catalog/master': { qrgBlankId: '11111', isActive: true },
    'bld_counters/SZ': { count: 4 }, 'asm_counters/global': { count: 2 },
    [`bld_definitions/${bldId}`]: { bldId, context: 'S', layoutMode: 'Z', sourceSessionId: 's', instanceCount: 10,
      instances: Array.from({ length: 10 }, (_, i) => ({ seq: String(i + 1).padStart(2, '0'), type: i === 1 ? 'qrc' : 'txt' })) },
    [`bld_definitions/${bldId}/instances/01`]: { old: true },
    [`assemblies/${assemblyId}`]: { assemblyId, sequence: 2, qrgId: '11111', bldId,
      mappings: [{ seq: '02', type: 'txt', value: 'Wrong QR slot' }], packetIds: ['p'] },
    'productPackets/p': { bldId, assemblyId, buildSessionId: 's', builderSnapshot: snapshot, qrContent: 'https://qrgear.com/scan/test', compositeUrl: 'https://files/composite.png', status: 'draft' },
    'admin_build_sessions/s': { bldId, assemblyId, sourceMasterId: 'master', status: 'committed', generated: { packetId: 'p', artifactReady: true }, working: snapshot },
    'admin_catalog_instances/i': { bldId, assemblyId, currentPacketId: 'p', sourceSessionId: 's', sourceMasterId: 'master' },
  });
  const files: Buffer[] = [];
  const bucket = () => ({ name: 'test', file: () => ({ save: async (b: Buffer) => files.push(b), makePublic: async () => {} }) });
  return { db, store, bucket, files, snapshot, bldId, assemblyId };
}
