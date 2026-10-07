import { describe, it, expect, vi } from 'vitest';
import { createBuildDeletion, ownedStoragePath } from '../../../../functions/src/services/build-deletion';
import { inspectGrfAsset, parseGrfId } from '../../../../shared/GRF_engine';
const image = 'GRF-21111-000001';
const qr = 'GRF-21121-000002';
const source = 'GRF-11411-000003';
const crop = 'GRF-11421-000004';
const bucketName = 'test-bucket';
const url = (id: string) => `https://storage.googleapis.com/${bucketName}/grf/${id}/image.png`;
const asset = (id: string, extra = {}) => ({ ...parseGrfId(id), grfId: id, publicUrl: url(id), storagePath: `grf/${id}/image.png`, isActive: true, ...extra });
function fixture(initial: Record<string, any>) {
  const docs = new Map(Object.entries(initial));
  let failures = false;
  const deletedFiles: string[] = [];
  const collections = (parent = '') => [...new Set([...docs.keys()].filter(p => p.startsWith(parent ? parent + '/' : '')).map(p => p.slice(parent ? parent.length + 1 : 0).split('/')[0]))].map(id => collection(parent ? `${parent}/${id}` : id));
  const snap = (path: string): any => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => docs.get(path), ref: ref(path) });
  const ref = (path: string): any => ({ path, id: path.split('/').pop(), get: async () => snap(path), listCollections: async () => collections(path), set: async (data: any) => docs.set(path, data) });
  const collection = (path: string): any => ({ id: path.split('/').pop(), path, doc: (id: string) => ref(`${path}/${id}`),
    get: async () => ({ docs: [...docs.keys()].filter(p => p.startsWith(path + '/') && p.split('/').length === path.split('/').length + 1).map(snap) }),
    where: (key: string, _op: string, value: any) => ({ get: async () => ({ docs: (await collection(path).get()).docs.filter((d: any) => d.data()[key] === value) }) }) });
  const db: any = { collection, doc: ref, listCollections: async () => collections(), runTransaction: async (fn: any) => {
    const writes: (() => void)[] = [];
    await fn({ get: (r: any) => r.get(), delete: (r: any) => writes.push(() => { docs.delete(r.path); }), set: (r: any, data: any) => writes.push(() => { docs.set(r.path, data); }), update: (r: any, data: any) => writes.push(() => { docs.set(r.path, { ...docs.get(r.path), ...data }); }) });
    writes.forEach(write => write());
  } };
  const service = createBuildDeletion({ db, now: () => 'now', bucket: () => ({ name: bucketName, file: (path: string) => ({ delete: async () => { if (failures) throw new Error('Storage unavailable'); deletedFiles.push(path); } }) }) });
  return { ...service, preview: (id: string) => service.preview({ kind: 'graphics', id }), remove: (id: string, token: string) => service.remove({ kind: 'graphics', id }, token), lifecycle: service, docs, deletedFiles, failStorage: (value: boolean) => { failures = value; } };
}
const build = () => ({
  [`grf_assets/${image}`]: asset(image, { packetId: 'packet' }), [`grf_assets/${qr}`]: asset(qr, { packetId: 'packet' }),
  [`grf_assets/${source}`]: asset(source),
  'assemblies/assembly': { mappings: [{ grfId: image }, { grfId: qr }], packetIds: ['packet'], bldId: 'BLD-SZ2-001' },
  'productPackets/packet': { productName: 'Training shirt', assemblyId: 'assembly', buildSessionId: 'session', bldId: 'BLD-SZ2-001', compositeImageUrl: url(image) },
  'admin_build_sessions/session': { generated: { packetId: 'packet' }, committedInstanceId: 'catalog-item' },
  'admin_catalog_instances/catalog-item': { currentPacketId: 'packet', sourceSessionId: 'session', collectionId: 'training' },
  'productTemplates/template': { packetId: 'packet' }, 'storeProductLinks/link': { packetId: 'packet' },
  'bld_definitions/BLD-SZ2-001': { source: 'builder' },
  'storeCollections/training': { name: 'My training collection' }, 'master_catalog/blank': { qrgBlankId: '11101' },
});
describe('coordinated GRF deletion', () => {
  it('uses the same dependency cleanup when deletion starts from a catalog item or packet', async () => {
    for (const target of [{ kind: 'catalog-instances' as const, id: 'catalog-item' }, { kind: 'packets' as const, id: 'packet' }]) {
      const f = fixture(build()); const preview = await f.lifecycle.preview(target); await f.lifecycle.remove(target, preview.token);
      expect(f.docs.has('productPackets/packet')).toBe(false); expect(f.docs.has('admin_catalog_instances/catalog-item')).toBe(false);
      expect(f.docs.has(`grf_assets/${image}`)).toBe(false); expect(f.docs.has(`grf_assets/${source}`)).toBe(true);
    }
  });
  it('previews named builds without mutation, then deletes their complete local records and files', async () => {
    const f = fixture(build()); const preview = await f.preview(image);
    expect(preview.targets.some(t => t.name === 'Training shirt')).toBe(true); expect(f.docs.has('productPackets/packet')).toBe(true);
    await expect(f.remove(image, preview.token)).resolves.toMatchObject({ success: true });
    for (const path of ['productPackets/packet','assemblies/assembly','admin_catalog_instances/catalog-item','admin_build_sessions/session','productTemplates/template','storeProductLinks/link','bld_definitions/BLD-SZ2-001']) expect(f.docs.has(path), path).toBe(false);
    expect(f.docs.has(`grf_assets/${source}`)).toBe(true); expect(f.docs.has('storeCollections/training')).toBe(true); expect(f.docs.has('master_catalog/blank')).toBe(true);
    expect(f.deletedFiles).toHaveLength(2);
  });
  it('preserves files and assets shared by nested website records, clearing deleted build ownership', async () => {
    const f = fixture({ ...build(), 'websites/site': {}, 'websites/site/pages/home': { imageUrl: url(qr) } });
    const p = await f.preview(image); await f.remove(image, p.token);
    expect(f.docs.has(`grf_assets/${qr}`)).toBe(true); expect(f.docs.get(`grf_assets/${qr}`).packetId).toBe(null);
    expect(f.deletedFiles).not.toContain(`grf/${qr}/image.png`); expect(f.docs.has('websites/site/pages/home')).toBe(true);
  });
  it('does not delete unrelated builds that merely share a reusable input or BLD', async () => {
    const initial = build(); (initial['productPackets/packet'] as any).backgroundImageUrl = url(source);
    const f = fixture({ ...initial, 'productPackets/other': { bldId: 'BLD-SZ2-001', backgroundImageUrl: url(source) } });
    const p = await f.preview(image); await f.remove(image, p.token);
    expect(f.docs.has('productPackets/other')).toBe(true); expect(f.docs.has('bld_definitions/BLD-SZ2-001')).toBe(true); expect(f.docs.has(`grf_assets/${source}`)).toBe(true);
  });
  it('retains a build still referenced by a surviving order or website, and recognizes embedded CSS URLs', async () => {
    const f = fixture({ ...build(), 'orders/order': { packetId: 'packet' }, 'websites/site': { css: `body { background: url("${url(qr)}") }` } });
    const p = await f.preview(image);
    expect(p.targets.some(t => t.id === 'packet')).toBe(false); expect(p.retained.some(a => a.id === image)).toBe(true);
  });
  it('rejects changed dependencies until the user reviews the new impact', async () => {
    const f = fixture(build()); const p = await f.preview(image);
    f.docs.set('productPackets/new-use', { compositeImageUrl: url(image) });
    await expect(f.remove(image, p.token)).rejects.toMatchObject({ status: 409 });
    expect(f.docs.has('productPackets/packet')).toBe(true); expect(f.deletedFiles).toHaveLength(0);
  });
  it('keeps failed cleanup visible and completes the same operation without orphaning files', async () => {
    const f = fixture(build()); const p = await f.preview(image); f.failStorage(true);
    await expect(f.remove(image, p.token)).resolves.toMatchObject({ cleanupPending: true, remainingFiles: 2 });
    expect(await f.pending()).toHaveLength(1); f.failStorage(false);
    await expect(f.finish(p.token)).resolves.toMatchObject({ success: true }); expect(await f.pending()).toHaveLength(0);
    await expect(f.remove(image, p.token)).resolves.toMatchObject({ success: true });
  });
  it('includes derived crops when their original is explicitly deleted', async () => {
    const f = fixture({ [`grf_assets/${source}`]: asset(source), [`grf_assets/${crop}`]: asset(crop, { sourceGrfId: source }), 'admin_build_sessions/draft': { working: { imageUrl: url(crop) } } });
    const p = await f.preview(source); expect(p.targets.map(t => t.id)).toEqual(expect.arrayContaining([source,crop,'draft']));
  });
  it('never treats another bucket or external supplier URL as an owned file', () => {
    expect(ownedStoragePath('https://storage.googleapis.com/other/file.png', bucketName)).toBe(null);
    expect(ownedStoragePath('https://example.com/file.png', bucketName)).toBe(null);
    expect(ownedStoragePath(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/grf%2Ffile.png?alt=media`, bucketName)).toBe('grf/file.png');
  });
});
describe('GRF metadata uses the encoded schema', () => {
  it('rejects valid-looking but mismatched categories and formats', () => {
    expect(inspectGrfAsset(asset(image))).toEqual([]);
    expect(inspectGrfAsset({ ...asset(image), channel: '3', mimeType: 'image/jpeg' })).toEqual(expect.arrayContaining(['channel does not match the GRF ID.','MIME type does not match the GRF format.']));
  });
});
