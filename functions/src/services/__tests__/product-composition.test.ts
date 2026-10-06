import { describe, it, expect } from 'vitest';
import { buildWorkingSnapshot, requireBuilderSnapshot } from '../../../../shared/builderSnapshot';
import { applyBuilderBld, extractBldInstances, sameBldStructure } from '../../../../shared/bldCodes';
import { validateAssemblyMappings } from '../../../../shared/assemblyCodes';
import { createGrfRegistrar } from '../grf-store';
import { resolveBuilderBld } from '../bld-store';
import { createAutoAssembly, extractAssemblyMappings, validatePacketComposition, packetPrintifyArtwork } from '../assembly-store';
import { readGeneratedBuild, deleteBuildPacket } from '../build-session-state';

function database(seed: Record<string, any>) {
  const store = new Map(Object.entries(seed));
  const patch = (path: string, data: any) => {
    const result = structuredClone(store.get(path) || {});
    for (const [field, value] of Object.entries(data)) {
      const keys = field.split('.'); let obj = result;
      for (const key of keys.slice(0, -1)) obj = obj[key] ||= {};
      obj[keys[keys.length - 1]] = value;
    }
    store.set(path, result);
  };
  const ref = (path: string): any => ({ path, id: path.split('/').pop(),
    get: async () => ({ exists: store.has(path), data: () => structuredClone(store.get(path)), ref: ref(path) }),
    set: async (data: any) => store.set(path, data), update: async (data: any) => patch(path, data) });
  const db: any = { collection: (collection: string) => ({ doc: (id: string) => ref(`${collection}/${id}`),
    where: (field: string, op: string, value: any) => {
      const query: any = { limit: () => query, get: async () => {
        const docs = Array.from(store.entries()).filter(([path, data]) => {
          const v = field.split('.').reduce((v, k) => v?.[k], data);
          return path.startsWith(`${collection}/`) && (op === 'array-contains' ? v?.includes(value) : v === value);
        }).map(([path, data]) => ({ id: path.split('/').pop(), data: () => structuredClone(data), ref: ref(path) }));
        return { docs, empty: !docs.length, size: docs.length };
      } }; return query;
    } }), runTransaction: async (fn: any) => {
      const writes: Array<() => void> = [];
      const result = await fn({ get: (r: any) => r.get(),
        set: (r: any, data: any) => writes.push(() => patch(r.path, data)),
        update: (r: any, data: any) => writes.push(() => patch(r.path, data)),
        create: (r: any, data: any) => writes.push(() => { if (store.has(r.path)) throw new Error('collision'); store.set(r.path, data); }),
        delete: (r: any) => writes.push(() => { store.delete(r.path); }),
      }); writes.forEach(w => w()); return result;
    } };
  return { db, store };
}
function fixture() {
  return buildWorkingSnapshot({ content: { graphicLayoutMode: 'freeform', qrSizePercent: 45, qrPositionX: 30, qrPositionY: 65,
    areaImageUrl: 'https://files/area.png', areaImageScale: 70, areaImageOffsetX: 40, areaImageOffsetY: 50,
    headerStyle: { enabled: true, mode: 'image', imageUrl: 'https://files/header.png', imageScale: 90, verticalOffset: 30 },
    footerStyle: { enabled: true, text: 'Scan here', fontFamily: 'Arial', fontSize: 28, color: '#fff' },
    landingTextBlocks: [{ enabled: true, text: 'Only on the destination' }] },
    loadedBackground: { url: 'https://files/landing.png' }, selectedProduct: { docId: 'master', placements: [
      { id: 'back', provider: 'printify', providerPlacement: 'back', dimensions: { widthPx: 3000, heightPx: 4000 } },
      { id: 'left_sleeve', provider: 'printify', providerPlacement: 'sleeve_left', dimensions: { widthPx: 1000, heightPx: 1500 } }] },
    selectedPlacements: ['back', 'left_sleeve'], placementConfig: {}, placementMethods: {}, placementSizes: {}, qrProductState: 'qr_basics',
  }, { selectedRole: null, selectedStore: null, selectedChannel: null, selectedCollection: null });
}
async function generated() {
  const snapshot = fixture();
  const { db, store } = database({ 'master_catalog/master': { qrgBlankId: '11001', isActive: true },
    'productPackets/p': { buildSessionId: 's', builderSnapshot: snapshot, qrContent: 'https://example.com/scan', compositeUrl: 'https://files/back.png',
      placementGraphicUrls: { back: 'https://files/back.png', left_sleeve: 'https://files/sleeve.png' } },
    'admin_build_sessions/s': { generated: { packetId: 'p', artifactReady: true } },
  });
  const uploads: Buffer[] = [];
  const registrar = createGrfRegistrar({ db, now: () => 'now', bucket: () => ({ name: 'test', file: () => ({ save: async (b: Buffer) => uploads.push(b), makePublic: async () => {} }) }) });
  const packet = () => store.get('productPackets/p');
  const grfs = await registrar.registerPacketGrfAssets(packet(), 's', 'p');
  const bld = await resolveBuilderBld(db, () => 'now', snapshot, 'p');
  const asm = await createAutoAssembly(db, () => 'now', { working: snapshot, qrgId: '11001', bldId: bld.bldId, packetId: 'p', sourceSessionId: 's', grfIds: grfs });
  return { db, store, snapshot, packet, grfs, bld, asm, uploads, registrar };
}
describe('product builder composition', () => {
  it('generates real QR bytes, binds physical slots and resolves back/sleeve publication', async () => {
    const f = await generated();
    expect(f.uploads[0].subarray(1, 4).toString()).toBe('PNG');
    expect(f.bld.instances.map((s: any) => s.type)).toEqual(['img', 'qrc', 'img', 'txt']);
    const asm = f.store.get(`assemblies/${f.asm.assemblyId}`);
    expect(asm.mappings.map((m: any) => m.type)).toEqual(['img', 'qrc', 'img', 'txt']);
    expect(asm.mappings[3].value).toBe('Scan here');
    expect(JSON.stringify(f.bld)).not.toContain('https://');
    expect(JSON.stringify(asm.mappings)).not.toContain('imageUrl');
    await expect(validatePacketComposition(f.db, 'p', f.packet())).resolves.toBeTruthy();
    expect(await packetPrintifyArtwork(f.db, f.packet())).toEqual([
      { position: 'back', imageUrl: 'https://files/back.png' }, { position: 'sleeve_left', imageUrl: 'https://files/sleeve.png' }]);
  });
  it('loads and reuses the saved BLD with new text; changed structure gets a new BLD', async () => {
    const f = await generated();
    const content = applyBuilderBld(f.bld, f.snapshot.graphics.content);
    const loaded = { ...f.snapshot, graphics: { ...f.snapshot.graphics, content }, metadata: { ...f.snapshot.metadata, selectedBldId: f.bld.bldId } };
    expect(sameBldStructure(f.bld, requireBuilderSnapshot(loaded).bldDraft)).toBe(true);
    loaded.graphics.content.footerStyle.text = 'New words';
    expect((await resolveBuilderBld(f.db, () => 'now', loaded)).bldId).toBe(f.bld.bldId);
    loaded.graphics.content.qrSizePercent = 60;
    expect((await resolveBuilderBld(f.db, () => 'now', loaded)).bldId).not.toBe(f.bld.bldId);
  });
  it('rejects missing QR, wrong-type bindings and mappings outside the BLD', () => {
    const working = { graphics: { content: { graphicLayoutMode: 'zone', headerStyle: { enabled: true, text: 'Header' } } } };
    expect(() => extractAssemblyMappings(working)).toThrow('slot 01');
    const slots = extractBldInstances(working);
    expect(validateAssemblyMappings([{ seq: '01', type: 'txt', value: 'Header' }], slots)).toContain('type does not match');
    expect(validateAssemblyMappings([{ seq: '03', type: 'txt', value: 'Extra' }], slots)).toContain('no BLD slot');
  });
  it('keeps permanent file, BLD and Assembly identities on repeated finalization', async () => {
    const f = await generated(); const count = f.store.size;
    const ids = await f.registrar.registerPacketGrfAssets(f.packet(), 's', 'p');
    expect(ids).toEqual(f.grfs);
    expect((await resolveBuilderBld(f.db, () => 'now', f.snapshot, 'p')).bldId).toBe(f.bld.bldId);
    expect((await createAutoAssembly(f.db, () => 'now', { working: f.snapshot, qrgId: '11001', bldId: f.bld.bldId, packetId: 'p', sourceSessionId: 's', grfIds: ids })).assemblyId).toBe(f.asm.assemblyId);
    expect(f.store.size).toBe(count); expect(f.uploads).toHaveLength(1);
  });
  it('prevents publication of archived files, changed content or a missing Assembly', async () => {
    const f = await generated();
    const qr = f.store.get(`grf_assets/${f.grfs.qrGrfId}`); qr.isActive = false;
    await expect(validatePacketComposition(f.db, 'p', f.packet())).rejects.toThrow('archived'); qr.isActive = true;
    f.packet().builderSnapshot.graphics.content.footerStyle.text = 'Not rendered';
    await expect(validatePacketComposition(f.db, 'p', f.packet())).rejects.toThrow('content differs');
    f.packet().builderSnapshot.graphics.content.footerStyle.text = 'Scan here';
    f.store.delete(`assemblies/${f.asm.assemblyId}`);
    await expect(validatePacketComposition(f.db, 'p', f.packet())).rejects.toThrow('not linked');
  });
  it('resumes the generated snapshot and deletes output while retaining reusable assets', async () => {
    const f = await generated();
    const saved = await readGeneratedBuild(f.db, { id: 's', sourceMasterId: 'master', generated: { packetId: 'p' } });
    expect(saved).toEqual(requireBuilderSnapshot(f.snapshot));
    await deleteBuildPacket(f.db, 'p', 'now');
    expect(f.store.has('productPackets/p')).toBe(false);
    expect(f.store.has(`bld_definitions/${f.bld.bldId}`)).toBe(true);
    expect(f.store.has(`grf_assets/${f.grfs.qrGrfId}`)).toBe(true);
    expect(f.store.get(`assemblies/${f.asm.assemblyId}`).packetIds).toEqual([]);
  });
});
