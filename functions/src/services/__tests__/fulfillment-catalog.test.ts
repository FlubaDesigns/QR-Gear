import { beforeEach, describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const m = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, any>>, writes: [] as any[], fetch: vi.fn(), configured: true }));
vi.mock('../../core', () => {
  const ref = (collection: string, id: string): any => ({ id,
    get: async () => ({ id, exists: !!m.rows[collection]?.[id], data: () => m.rows[collection]?.[id] }),
    set: async (data: any) => { m.writes.push([collection, id, data]); (m.rows[collection] ||= {})[id] = { ...m.rows[collection]?.[id], ...data }; },
    update: async (data: any) => ref(collection, id).set(data),
  });
  const collection = (name: string) => {
    const filters: any[] = []; let limit = Infinity;
    const q: any = {
      doc: (id: string = `job-${Object.keys(m.rows[name] || {}).length}`) => ref(name, id),
      add: async (data: any) => { const id = `job-${Object.keys(m.rows[name] || {}).length}`; await ref(name, id).set(data); return ref(name, id); },
      where: (field: string, _op: string, value: any) => { filters.push([field, value]); return q; },
      orderBy: () => q, limit: (n: number) => { limit = n; return q; },
      get: async () => {
        const docs = Object.entries(m.rows[name] || {}).filter(([, d]) => filters.every(([f, v]) => d[f] === v)).slice(0, limit)
          .map(([id, data]) => ({ id, data: () => data, ref: ref(name, id) }));
        return { docs, empty: !docs.length, size: docs.length, forEach: (f: any) => docs.forEach(f) };
      },
    }; return q;
  };
  return { db: { collection, runTransaction: async (fn: any) => fn({ get: (r: any) => r.get(), create: (r: any, d: any) => r.set(d), update: (r: any, d: any) => r.update(d) }), batch: () => { const writes: any[] = []; return { set: (r: any, data: any) => writes.push([r, data]), commit: async () => { for (const [r, data] of writes) await r.set(data); } }; } },
    admin: { firestore: { FieldValue: { serverTimestamp: () => ({ toDate: () => new Date('2026-10-07T00:00:00Z') }) } } },
    normalizePrintfulCategory: () => 'T-Shirts',
  };
});
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../services/printful', () => ({ printfulClient: { get isConfigured() { return m.configured; },getCatalogProducts:async()=>{if(!m.configured)throw Object.assign(Error('not configured'),{status:503});return (await (await m.fetch('https://api.printful.com/products')).json()).result;},getProduct:async(id:number)=>{const r=await m.fetch('https://api.printful.com/products/'+id);if(!r.ok)throw Error('Provider failed');return (await r.json()).result;} }, getPrintfulApiKeyAsync: async () => 'test-only' }));
vi.mock('../../services/printify', () => ({ printifyClient: { get isConfigured() { return m.configured; }, getCatalogBlueprints: async () => [{ id: 12, title: 'Tee', brand: 'Maker', model: 'Style' }], getBlueprintDetails: async () => ({ description: 'Description' }) } }));
vi.mock('../../services/master-catalog', () => ({ syncMasterCatalog: async () => ({ updated: 1 }), resolveQrgCategoryLabel: (x: any) => x, QRG_BLANK_CATEGORIES: [{ name: 'T-Shirts' }], QRG_TOP_LEVEL_CATEGORIES: [] }));
vi.mock('../../services/storage-helpers', () => ({}));
vi.mock('../../services/pricing', () => ({}));
vi.mock('../../services/mockup-generator', () => ({}));
vi.mock('../../services/email', () => ({}));
vi.mock('../../services/composite-image', () => ({}));
import { register } from '../../routes/pp-catalog';
const app = express(); app.use(express.json()); register(app);
async function runSync(path: string) {
 const started = await request(app).post(path).send({});
 let result = started;
 for (let i=0; i<10 && result.body.status === 'running'; i++) result = await request(app).post(path).send({syncId: started.body.syncId});
 return result;
}
const timestamp = { toDate: () => new Date('2026-10-07T00:00:00Z') };
beforeEach(() => { m.rows = {}; m.writes = []; m.configured = true; vi.clearAllMocks(); vi.stubGlobal('fetch', m.fetch); });
describe('Fulfillment catalog routes with in-memory supplier and Firestore adapters', () => {
  it.each(['legacy-printify', 'printful-string', 'current-object'])('preserves %s totals and normalizes timestamps', async format => {
    const summary = format === 'legacy-printify' ? { blueprints: { added: 2, updated: 1, skipped: 4, total: 7 } } : { products: { added: 2, updated: 1, skipped: 4, total: 7 } };
    m.rows.catalogSyncs = { job: { status: 'completed', startedAt: timestamp, completedAt: timestamp, ...(format === 'legacy-printify' ? { errorMessage: JSON.stringify(summary) } : { summary: format === 'printful-string' ? JSON.stringify(summary) : summary }) } };
    const res = await request(app).get('/admin/catalog/sync-status?syncId=job');
    expect(res.status).toBe(200); expect(res.body.summary).toEqual(summary); expect(res.body.completedAt).toBe('2026-10-07T00:00:00.000Z'); expect(res.body.errorMessage).toBeNull();
  });
  it('keeps provider history separate and returns explicit errors', async () => {
    m.rows.catalogSyncs = { py: { status: 'completed', syncType: 'smart' }, pf: { status: 'failed', syncType: 'printful', errorMessage: 'Supplier unavailable' } };
    expect((await request(app).get('/admin/catalog/sync-status?provider=printful')).body).toMatchObject({ id: 'pf', errorMessage: 'Supplier unavailable' });
    expect((await request(app).get('/admin/catalog/sync-status?provider=printify')).body.id).toBe('py');
    expect((await request(app).get('/admin/catalog/sync-status?provider=unknown')).status).toBe(400);
    expect((await request(app).get('/admin/catalog/sync-status?syncId=missing')).status).toBe(404);
  });
  it.each(['0501', '10501', '1050001'])('preserves both supplier lookups and QRG identity for variant %s', async code => {
    m.rows.master_catalog = { qrg_11001: { qrgBlankId: '11001', qrgCategory: 'T-Shirts', title: 'Tee', providerMappings: { printify: { blueprintId: '12', printProviderId: '99' }, printful: { productId: '71' } }, availableVia: ['printify', 'printful'], qrgVariants: { [code]: { sizeLabel: 'L', colorLabel: 'Black' } } } };
    const res = await request(app).get('/master-catalog'); const item = res.body[0].items[0];
    expect(item).toMatchObject({ docId: 'qrg_11001', qrgBlankId: '11001', blueprintId: '12', printfulId: '71', printProviderId: '99', availableVia: ['printify', 'printful'] });
    expect(item.providerMappings).toHaveLength(2); expect(item.colorMap).toEqual([expect.objectContaining({ qrgColorCode: '01', colorName: 'Black' })]); expect(item.sizeMap[0].sizeLabel).toBe('L');
    expect(m.writes).toHaveLength(0);
  });
  it('supports legacy mapping arrays and stored size/color coverage without inventing a supplier', async () => {
    m.rows.master_catalog = { qrg_11001: { qrgCategory: 'T-Shirts', providerMappings: [{ provider: 'printful', productId: 71 }], availableSizes: ['05'], availableColors: ['01'] }, qrg_11002: { qrgCategory: 'T-Shirts' } };
    const items = (await request(app).get('/master-catalog')).body[0].items;
    expect(items[0].sizeMap[0]).toMatchObject({ qrgSizeCode: '05', sizeLabel: 'L' }); expect(items[0].printfulId).toBe(71); expect(items[1].availableVia).toEqual([]);
  });
  it('writes Printful lookup products and variants where the QRG builder reads them, including price-only changes', async () => {
    m.rows.printful_products = { '71': { id: 71, title: 'Tee', brand: 'Maker', model: 'Style', variantCount: 1, minPrice: '10.00' } };
    m.rows.printfulCatalog = { '71': { ...m.rows.printful_products['71'] } };
    m.fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ result: url.endsWith('/71') ? { variants: [{ id: 701, size: 'L', color: 'Black', color_code: '#000000', price: '12.00' }] } : [{ id: 71, title: 'Tee', type: 'T-Shirt', brand: 'Maker', model: 'Style', variant_count: 1 }] }) }));
    const res = await runSync('/admin/catalog/sync-printful'); expect(res.status).toBe(200);
    await vi.waitFor(() => expect(m.rows.catalogSyncs[res.body.syncId].status).toBe('completed'));
    expect(m.rows.printful_products['71'].minPrice).toBe('12.00'); expect(m.rows.printfulCatalog['71'].minPrice).toBe('12.00');
    expect(m.rows.printful_variants['701']).toMatchObject({ productId: 71, size: 'L', color: 'Black' });
    expect(m.rows.catalogSyncs[res.body.syncId].summary.products).toMatchObject({ updated: 1, failed: 0, total: 1 });
    expect(m.writes.some(([collection]) => collection === 'master_catalog')).toBe(false);
  });
  it('does not report a successful Printful sync when a product detail fails', async () => {
    m.fetch.mockImplementation(async (url: string) => url.endsWith('/71') ? { ok: false, status: 503 } : { ok: true, json: async () => ({ result: [{ id: 71, title: 'Tee' }] }) });
    const res = await runSync('/admin/catalog/sync-printful');
    await vi.waitFor(() => expect(m.rows.catalogSyncs[res.body.syncId].status).toBe('failed'));
    expect(m.rows.catalogSyncs[res.body.syncId].summary.products.failed).toBe(1);
    expect(m.rows.printful_products).toBeUndefined();
  });
  it('syncs Printify to its lookup table and stores a real summary', async () => {
    const res = await runSync('/admin/catalog/sync');
    await vi.waitFor(() => expect(m.rows.catalogSyncs[res.body.syncId].status).toBe('completed'));
    expect(m.rows.printify_blueprints['12'].title).toBe('Tee');
    expect(m.rows.catalogSyncs[res.body.syncId].summary.blueprints).toMatchObject({ added: 1, total: 1 });
  });
  it.each(['/admin/catalog/sync', '/admin/catalog/sync-printful'])('rejects %s when credentials are unavailable', async path => {
    m.configured = false; expect((await request(app).post(path).send({})).status).toBe(503); expect(m.writes).toHaveLength(0);
  });
});

it('finds the newest provider job without a composite index or arbitrary limit', async () => {
 m.rows.catalogSyncs = {
  old: {syncType:'printful',startedAt:'2026-01-01T00:00:00Z',status:'completed'},
  newest: {syncType:'printful',startedAt:'2026-10-09T00:00:00Z',status:'failed'},
  other: {syncType:'smart',startedAt:'2026-12-01T00:00:00Z',status:'completed'},
 };
 const res=await request(app).get('/admin/catalog/sync-status?provider=printful');
 expect(res.status).toBe(200);expect(res.body.id).toBe('newest');expect(m.writes).toHaveLength(0);
});

it('reports expired running history as incomplete without writing or claiming completion', async () => {
 m.rows.catalogSyncs = { old: { syncType: 'printful', startedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(), status: 'running' } };
 const response = await request(app).get('/admin/catalog/sync-status?provider=printful');
 expect(response.body).toMatchObject({status:'failed'}); expect(response.body.errorMessage).toContain('did not record completion'); expect(m.writes).toHaveLength(0);
 m.rows.catalogSyncs.old.startedAt = new Date().toISOString();
 expect((await request(app).get('/admin/catalog/sync-status?syncId=old')).body.status).toBe('running');
});

it('checkpoints each response, resumes a failed step, and skips unchanged supplier rows', async () => {
 m.fetch.mockImplementation(async (url: string) => ({ok:true,json:async()=>({result:url.endsWith('/71')?{variants:[{id:701,size:'L',color:'Black',price:'12.00'}]}:[{id:71,title:'Tee'}]})}));
 const start=await request(app).post('/admin/catalog/sync-printful').send({});
 expect(start.body).toMatchObject({status:'running',processed:0,total:1,resumable:true});
 expect(start.body.queue).toBeUndefined(); expect(m.rows.printful_products).toBeUndefined();
 m.fetch.mockRejectedValueOnce(new Error('Unavailable'));
 const failed=await request(app).post('/admin/catalog/sync-printful').send({syncId:start.body.syncId});
 expect(failed.body.status).toBe('failed'); expect(failed.body.processed).toBe(0);
 const resumed=await request(app).post('/admin/catalog/sync-printful').send({});
 expect(resumed.body.syncId).toBe(start.body.syncId);
 const imported=await request(app).post('/admin/catalog/sync-printful').send({syncId:start.body.syncId});
 expect(imported.body).toMatchObject({status:'running',processed:1,phase:'rebuilding'});
 const complete=await request(app).post('/admin/catalog/sync-printful').send({syncId:start.body.syncId});
 expect(complete.body).toMatchObject({status:'completed',qrgSummary:{updated:1}});
 m.writes=[];
 const again=await runSync('/admin/catalog/sync-printful');
 expect(again.body.summary.products).toMatchObject({skipped:1,added:0,updated:0});
 expect(m.writes.filter(([c])=>c.startsWith('printful'))).toHaveLength(0);
});
it('does not run a duplicate leased step or resume through another provider', async () => {
 m.rows.catalogSyncs={active:{protocol:'request-v1',syncType:'printful',status:'running',queue:[{id:71}],cursor:0,leaseUntil:Date.now()+60000}};
 const res=await request(app).post('/admin/catalog/sync-printful').send({syncId:'active'});
 expect(res.status).toBe(200);expect(res.body.processed).toBe(0);expect(m.fetch).not.toHaveBeenCalled();
 expect((await request(app).post('/admin/catalog/sync').send({syncId:'active'})).status).toBe(409);
});
