import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { legacyFixture, database } from './composition-fixture';
import { registerCompositionRoutes } from '../admin-composition-routes';
import { createGrfRegistrar } from '../grf-store';
import { resolveBuilderBld } from '../bld-store';
import { createAutoAssembly } from '../assembly-store';
import { validatePacketComposition } from '../assembly-store';
import { updatePacketWithComposition } from '../composition-links';
import { saveGeneratedBuildArtifact } from '../build-session-state';
import { validateAssemblyMappings } from '../../../../shared/assemblyCodes';

async function generatedFixture(inlineImage?: string) {
  const source = legacyFixture();
  if (inlineImage) source.snapshot.graphics.content.footerStyle = { enabled: true, mode: 'image', imageUrl: inlineImage };
  const { db, store } = database({
    'master_catalog/master': source.store.get('master_catalog/master'),
    'productPackets/p': { buildSessionId: 's', builderSnapshot: source.snapshot, qrContent: 'https://example.com', compositeUrl: 'https://files/composite.png' },
    'admin_build_sessions/s': { sourceMasterId: 'master', generated: { packetId: 'p' }, working: source.snapshot },
    'admin_catalog_instances/i': { currentPacketId: 'p' },
  });
  const registrar = createGrfRegistrar({ db, now: () => 'now', bucket: source.bucket });
  const grfs = await registrar.registerPacketGrfAssets(store.get('productPackets/p'), 's', 'p');
  const bld = await resolveBuilderBld(db, () => 'now', source.snapshot, 'p');
  const result = await createAutoAssembly(db, () => 'now', { working: source.snapshot, qrgId: '11111', bldId: bld.bldId, packetId: 'p', sourceSessionId: 's', grfIds: grfs });
  return { db, store, result, snapshot: source.snapshot, bucket: source.bucket };
}

describe('schema chain enforcement', () => {
  it('binds inline builder images to registered bytes and rejects changed content', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';
    const f = await generatedFixture('data:image/png;base64,' + png);
    const packet = f.store.get('productPackets/p');
    await expect(validatePacketComposition(f.db, 'p', packet)).resolves.toBeTruthy();
    const changed = JSON.parse(JSON.stringify(packet));
    changed.builderSnapshot.graphics.content.footerStyle.imageUrl = 'data:image/png;base64,' + Buffer.concat([Buffer.from(png, 'base64'), Buffer.from('changed')]).toString('base64');
    await expect(validatePacketComposition(f.db, 'p', changed)).rejects.toThrow('file differs from the rendered image');
  });
  it.each(['/admin', '/api/admin'])('reports the same BLD and slot problems through %s', async prefix => {
    const f = legacyFixture(), app = express(); app.use(express.json());
    registerCompositionRoutes(app, prefix, (_req, _res, next) => next(), { db: () => f.db, now: () => 'now' });
    const bld = await request(app).get(`${prefix}/bld`);
    expect(bld.body.definitions[0].validationError).toContain('sourceSessionId');
    const asm = await request(app).get(`${prefix}/assemblies`);
    expect(asm.body.assemblies[0].validationErrors.join(' ')).toContain('sourceSessionId');
    expect(asm.body.assemblies[0].validationErrors.join(' ')).toContain('does not match BLD slot qrc');
    expect((await request(app).delete(`${prefix}/bld/${f.bldId}`)).status).toBe(409);
    expect((await request(app).delete(`${prefix}/assemblies/${f.assemblyId}`)).status).toBe(409);
  });
  it('blocks missing or mismatched Assembly links with no partial writes', async () => {
    const f = await generatedFixture();
    const before = JSON.stringify(Array.from(f.store));
    await expect(updatePacketWithComposition(f.db, 'p', { assemblyId: 'ASM-999999' }, 'now')).rejects.toThrow('does not exist');
    expect(JSON.stringify(Array.from(f.store))).toBe(before);
    const asm = f.store.get(`assemblies/${f.store.get('productPackets/p').assemblyId}`);
    f.store.set('assemblies/ASM-999998', { ...asm, assemblyId: 'ASM-999998', packetIds: [], mappings: [] });
    await expect(updatePacketWithComposition(f.db, 'p', { assemblyId: 'ASM-999998' }, 'now')).rejects.toThrow('has no mapping');
  });
  it('changes both sides and catalog/session references in one transaction', async () => {
    const f = await generatedFixture();
    const oldId = f.store.get('productPackets/p').assemblyId;
    f.store.set('assemblies/ASM-999998', { ...f.store.get(`assemblies/${oldId}`), assemblyId: 'ASM-999998', packetIds: [] });
    await updatePacketWithComposition(f.db, 'p', { assemblyId: 'ASM-999998' }, 'now');
    expect(f.store.get(`assemblies/${oldId}`).packetIds).toEqual([]);
    expect(f.store.get('assemblies/ASM-999998').packetIds).toEqual(['p']);
    for (const path of ['productPackets/p', 'admin_build_sessions/s', 'admin_catalog_instances/i']) expect(f.store.get(path).assemblyId).toBe('ASM-999998');
  });
  it('blocks content edits on a linked Assembly even with a stale reverse link', async () => {
    const f = await generatedFixture(); const result = f.result;
    f.store.get(`assemblies/${result.assemblyId}`).packetIds = [];
    const app = express(); app.use(express.json()); registerCompositionRoutes(app, '/admin', (_req, _res, next) => next(), { db: () => f.db, now: () => 'now' });
    const response = await request(app).patch(`/admin/assemblies/${result.assemblyId}`).send({ mappings: [] });
    expect(response.status).toBe(409);
    expect((await request(app).delete(`/admin/assemblies/${result.assemblyId}`)).status).toBe(409);
  });
  it('validates generation before marking ready and clears old draft identities on regeneration', async () => {
    const f = legacyFixture(); f.store.delete('admin_catalog_instances/i'); f.store.get('admin_build_sessions/s').status = 'working';
    await expect(saveGeneratedBuildArtifact(f.db, 's', { compositeUrl: 'https://files/new.png' }, 'now')).rejects.toThrow('snapshot');
    await saveGeneratedBuildArtifact(f.db, 's', { builderSnapshot: f.snapshot, compositeUrl: 'https://files/new.png', qrContent: 'https://example.com' }, 'now');
    expect(f.store.get('productPackets/p')).toMatchObject({ bldId: null, assemblyId: null, qrGrfId: null, compositeUrl: 'https://files/new.png' });
    expect(f.store.get(`assemblies/${f.assemblyId}`).packetIds).toEqual([]);
    expect(f.store.get('admin_build_sessions/s')).toMatchObject({ status: 'artifact_ready' });
  });
  it('rejects a changed QR payload before publication', async () => {
    const f = await generatedFixture(); const packet = f.store.get('productPackets/p');
    await expect(validatePacketComposition(f.db, 'p', packet)).resolves.toBeTruthy();
    await expect(validatePacketComposition(f.db, 'p', { ...packet, qrContent: 'https://different.example.com' })).rejects.toThrow('QR payload differs');
  });
  it('honors optional and empty BLD slots without renumbering later mappings', () => {
    const slots = [{ seq: '01', type: 'txt', required: false }, { seq: '02', type: 'txt' }];
    expect(validateAssemblyMappings([{ seq: '02', type: 'txt', value: 'Second' }], slots)).toBeNull();
    expect(validateAssemblyMappings([], [])).toBeNull();
    expect(validateAssemblyMappings([{ seq: '00', type: 'txt', value: 'Bad' }], slots)).toContain('01');
  });
});
