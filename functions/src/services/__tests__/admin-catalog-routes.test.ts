import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
import { registerCatalogRoutes } from '../admin-catalog-routes';
import { catalogTierProducts } from '../catalog-tier-products';
import { CATALOG_OVERLAY_FIELDS } from '../../../../shared/catalogs';
const first = 'qrg_11001', second = 'qrg_11002';
const colors = [{ name: 'Black', hex: '#000000' }];
function fixture(prefix: string, extra: Record<string, any> = {}) {
  const f = database({
    [`master_catalog/${first}`]: { qrgBlankId: '11001', title: 'Original', minPrice: 10, qrgCategory: 'Tees', images: ['https://images/original.png'], providerMappings: { printful: { productId: 71 } }, qrgVariants: { '1101': { colorLabel: 'Black', sizeLabel: 'M' } } },
    [`master_catalog/${second}`]: { qrgBlankId: '11002', title: 'Other' },
    'catalogs/source': { name: 'Source', blankIds: [first], blankColors: { [first]: colors }, blankImages: { [first]: [] }, blankTitles: { [first]: 'Curated' } },
    'catalogs/target': { name: 'Target', blankIds: [] }, 'catalogs/primary': { name: 'Primary', blankIds: [] },
    'printful_products/71': { title: 'Provider lookup' }, 'printify_blueprints/71': { title: 'Other lookup' }, ...extra,
  });
  const collection = f.db.collection;
  f.db.collection = (name: string) => {
    const c = collection(name), doc = c.doc;
    c.doc = (id?: string) => { const r = doc(id); r.create = async (data: any) => { if (f.store.has(r.path)) throw new Error('collision'); f.store.set(r.path, structuredClone(data)); }; return r; };
    return c;
  };
  // Serialize transaction requests in the test adapter; Firestore retries conflicts in production.
  const transaction = f.db.runTransaction; let queue = Promise.resolve();
  f.db.runTransaction = (fn: any) => { const result = queue.then(() => transaction(fn)); queue = result.catch(() => {}); return result; };
  const app = express(); app.use(express.json());
  registerCatalogRoutes(app, prefix, (_req: any, _res: any, next: any) => next(), { db: () => f.db, now: () => '2026-10-07' });
  return { ...f, api: request(app) };
}
for (const prefix of ['/admin', '/api/admin']) describe(prefix, () => {
  it('copies choices without writing master/provider tables or a hidden Primary destination', async () => {
    const f = fixture(prefix), before = [...f.store].filter(([p]) => !p.startsWith('catalogs/'));
    const created = await f.api.post(`${prefix}/catalogs`).send({ name: ' New ' });
    expect(created.status).toBe(201); expect(created.body.name).toBe('New');
    const copy = await f.api.post(`${prefix}/catalogs/target/blanks`).send({ blankIds: [first], sourceCatalogId: 'source' });
    expect(copy.body).toMatchObject({ added: 1, total: 1 });
    expect(f.store.get('catalogs/target')).toMatchObject({ blankColors: { [first]: colors }, blankImages: { [first]: [] }, blankTitles: { [first]: 'Curated' } });
    await f.api.put(`${prefix}/catalogs/target/blank-title`).send({ blankId: first, title: 'Target edit' });
    await f.api.post(`${prefix}/catalogs/source/bulk-copy`).send({ targetCatalogId: 'target', blankIds: [first] });
    expect(f.store.get('catalogs/target').blankTitles[first]).toBe('Target edit');
    expect(f.store.get('catalogs/primary').blankIds).toEqual([]);
    expect([...f.store].filter(([p]) => !p.startsWith('catalogs/'))).toEqual(before);
  });
  it('duplicates all overlays and removes them even if the master is missing', async () => {
    const f = fixture(prefix), dup = await f.api.post(`${prefix}/catalogs/source/duplicate`);
    expect(dup.status).toBe(201); expect(dup.body.blankColors[first]).toEqual(colors); expect(dup.body.blankImages[first]).toEqual([]);
    const path = `catalogs/${dup.body.id}`;
    for (const field of CATALOG_OVERLAY_FIELDS) f.store.get(path)[field][first] ??= 'test';
    f.store.delete(`master_catalog/${first}`);
    const removed = await f.api.delete(`${prefix}/catalogs/${dup.body.id}/blanks`).send({ blankIds: [first] });
    expect(removed.body.total).toBe(0);
    for (const field of CATALOG_OVERLAY_FIELDS) expect(f.store.get(path)[field]).toEqual({});
  });
  it('rolls back additions with missing blanks or provider IDs and rejects edits outside membership', async () => {
    const f = fixture(prefix);
    for (const bad of ['qrg_11003', '71', 'pf:71']) {
      const res = await f.api.post(`${prefix}/catalogs/target/blanks`).send({ blankIds: [first, bad] });
      expect(res.status).toBe(400); expect(res.body.failedBlankId).toBe(bad); expect(f.store.get('catalogs/target').blankIds).toEqual([]);
    }
    expect((await f.api.put(`${prefix}/catalogs/target/blank-colors`).send({ blankId: first, colors })).status).toBe(409);
  });
  it('preserves concurrent additions and distinct edits through transactions', async () => {
    const f = fixture(prefix);
    const added = await Promise.all([first, second].map(id => f.api.post(`${prefix}/catalogs/target/blanks`).send({ blankIds: [id] })));
    expect(added.map(r => r.status)).toEqual([200, 200]); expect(f.store.get('catalogs/target').blankIds.sort()).toEqual([first, second]);
    await Promise.all([f.api.put(`${prefix}/catalogs/target/blank-title`).send({ blankId: first, title: 'Edited' }), f.api.put(`${prefix}/catalogs/target/blank-colors`).send({ blankId: second, colors })]);
    expect(f.store.get('catalogs/target')).toMatchObject({ blankTitles: { [first]: 'Edited' }, blankColors: { [second]: colors } });
  });
  it('preserves empty selections until restore, protects assigned catalogs and clears deleted defaults', async () => {
    const f = fixture(prefix, { 'systemSettings/catalog-defaults': { defaultCatalogId: 'source' }, 'systemSettings/catalog-assignments': { member: 'source' } });
    expect((await f.api.delete(`${prefix}/catalogs/source`)).status).toBe(409);
    expect((await f.api.put(`${prefix}/catalogs/source/blank-colors`).send({ blankId: first, colors: [] })).status).toBe(200);
    expect(f.store.get('catalogs/source').blankColors[first]).toEqual([]);
    await f.api.put(`${prefix}/catalogs/source/blank-images`).send({ blankId: first, images: [], restore: true });
    expect(f.store.get('catalogs/source').blankImages).toEqual({});
    await f.api.put(`${prefix}/catalog-assignments`).send({ member: null });
    expect((await f.api.delete(`${prefix}/catalogs/source`)).status).toBe(200);
    expect(f.store.get('systemSettings/catalog-defaults').defaultCatalogId).toBeNull();
    expect((await f.api.put(`${prefix}/catalog-defaults`).send({ defaultCatalogId: 'missing' })).status).toBe(404);
  });
});
it('member products read QRG and curated choices rather than provider display rows', async () => {
  const f = fixture('/admin', { 'systemSettings/catalog-assignments': { member: 'source' } });
  f.store.get('catalogs/source').blankTiers = { [first]: 'good' }; f.store.get('catalogs/source').blankColors[first] = [];
  const result = await catalogTierProducts(f.db, 'member');
  expect(result.tiers.Tees.good.products[0]).toMatchObject({ canonicalBlankKey: first, blueprintId: 71, title: 'Curated', colors: [], images: [], imageUrl: null, cost: 10 });
  await expect(catalogTierProducts(f.db, 'invalid')).rejects.toThrow('Invalid catalog section');
});

it('limits fulfillment options to saved catalog colors, including empty selections', async () => {
  const { catalogColorOptions } = await import('../catalog-color-options');
  const f = fixture('/admin');
  const options = [...colors, { name: 'White', hex: '#ffffff' }];
  expect(await catalogColorOptions(f.db, 'source', first, options)).toEqual(colors);
  expect(await catalogColorOptions(f.db, null, first, options)).toEqual(options);
  f.store.get('catalogs/source').blankColors[first] = [];
  expect(await catalogColorOptions(f.db, 'source', first, options)).toEqual([]);
  await expect(catalogColorOptions(f.db, 'source', second, options)).rejects.toThrow('no longer in the selected catalog');
});
