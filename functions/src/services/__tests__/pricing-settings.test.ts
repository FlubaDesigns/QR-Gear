import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const m = vi.hoisted(() => ({ record: {} as any, set: vi.fn(), sync: vi.fn() }));
vi.mock('../../core', () => ({
  db: { collection: (name: string) => { if (name !== 'testSettings') throw Error('Unexpected collection'); return { doc: (id: string) => { if (id !== 'pricing') throw Error('Unexpected document'); return { get: async () => ({ exists: !!m.record, data: () => m.record }), set: m.set }; } }; } },
  admin: { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } },
}));
vi.mock('../../middleware', () => ({ requireAdmin: (req: any, res: any, next: any) => req.headers.authorization === 'Bearer owner' ? (req.user = {uid:'owner'}, next()) : res.status(401).end() }));
vi.mock('../../services/composition-links', () => ({ updatePacketWithComposition: vi.fn() }));
vi.mock('../../services/catalog-instance-update', () => ({ syncCatalogMarkup: m.sync }));
import { register } from '../../routes/pp-pricing-packets';
const zero = { markupPercent: 0, markupFixed: 0, additionalPlacementCost: 0, textLineUpcharge: 0, centerGraphicUpcharge: 0,
  memberProfitShare: 0, builtInShippingCost: 0, sizeUpcharges: { S: 0, XL: 0 }, hostingTiers: [{ code: 'year', name: 'Year', price: 0 }],
  brandLabelPricing: { printifyInside: 0, printifyOutside: 0, printfulInside: 0, printfulOutside: 0 }, preferredLabelPosition: 'outside' };
const app = express(); app.use(express.json()); register(app);
beforeEach(() => { vi.clearAllMocks(); m.record = { ...zero, baseRetailPrice: 20 }; m.set.mockImplementation(async (data: any) => { m.record = { ...m.record, ...data }; }); });
it('saves and reloads intentional zeros through both existing save URLs', async () => {
  for (const path of ['/admin/pricing-settings', '/pricing-settings']) {
    expect((await request(app).post(path).set('Authorization', 'Bearer owner').send(zero)).status).toBe(200);
    const result = await request(app).get('/pricing-settings');
    expect(result.status).toBe(200); expect(result.body).toMatchObject(zero);
    expect(result.body.baseRetailPrice).toBe(20); expect(result.headers['cache-control']).toBe('no-store');
  }
  expect(m.set).toHaveBeenCalledTimes(2);
});
it.each([null, '', -1, '12garbage'])('rejects invalid amounts (%s) without replacing saved values', async value => {
  const before = JSON.stringify(m.record);
  expect((await request(app).post('/admin/pricing-settings').set('Authorization','Bearer owner').send({ ...zero, builtInShippingCost: value })).status).toBe(400);
  expect(m.set).not.toHaveBeenCalled(); expect(JSON.stringify(m.record)).toBe(before);
});
it('rejects malformed nested settings and profit shares above 100 percent', async () => {
  for (const patch of [{memberProfitShare: 1.01}, {sizeUpcharges: {S: -1}}, {hostingTiers: [{code:'a',name:'A',price:0},{code:'a',name:'Again',price:0}]}, {brandLabelPricing: {}}]) {
    expect((await request(app).post('/admin/pricing-settings').set('Authorization','Bearer owner').send({ ...zero, ...patch })).status).toBe(400);
  }
  expect(m.set).not.toHaveBeenCalled();
});
it('does not invent prices when configuration is missing, and keeps both save URLs protected', async () => {
  m.record = undefined;
  expect((await request(app).get('/pricing-settings')).status).toBe(409);
  const admin = await request(app).get('/admin/pricing-settings').set('Authorization','Bearer owner');
  expect(admin.status).toBe(200); expect(admin.body).toEqual({});
  for (const path of ['/admin/pricing-settings','/pricing-settings']) expect((await request(app).post(path).send(zero)).status).toBe(401);
  expect(m.set).not.toHaveBeenCalled();
});

it('protects both Sync aliases and uses the same catalog preview/apply service', async () => {
  m.sync.mockResolvedValue({dryRun:true,productsUpdated:0,blocked:[]});
  for (const path of ['/admin/pricing-settings/sync','/pricing-settings/sync']) {
    expect((await request(app).post(path).send({})).status).toBe(401);
    expect((await request(app).post(path).set('Authorization','Bearer owner').send({previewToken:''})).status).toBe(400);
    const preview = await request(app).post(path).set('Authorization','Bearer owner').send({});
    expect(preview.status).toBe(200); expect(preview.body.productsUpdated).toBe(0);
    expect(m.sync.mock.calls[m.sync.mock.calls.length - 1]?.slice(1)).toEqual(['server-time','owner',undefined]);
    const token = 'a'.repeat(64);
    expect((await request(app).post(path).set('Authorization','Bearer owner').send({previewToken:token})).status).toBe(200);
    expect(m.sync.mock.calls[m.sync.mock.calls.length - 1]?.slice(1)).toEqual(['server-time','owner',token]);
  }
  expect(m.sync).toHaveBeenCalledTimes(4);
});
