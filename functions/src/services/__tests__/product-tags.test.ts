import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerProductTagRoutes } from '../product-tags';
import { DEFAULT_PRODUCT_TAGS } from '../../../../shared/productTags';
function fixture(prefix: string) {
  const records = new Map<string, any>([['old', { name: 'Legacy', slug: 'legacy', isActive: false }]]);
  let counter = 0;
  const snapshot = () => ({ docs: Array.from(records, ([id, data]) => ({ id, data: () => data })) });
  const get = vi.fn(async () => snapshot());
  const collection: any = { get, doc: (id?: string) => ({ id: id || `new-${++counter}` }) };
  const db = { collection: vi.fn((_name: string) => collection), runTransaction: vi.fn(async (fn: any) => {
    const writes: (() => void)[] = [];
    const result = await fn({
      get: async (ref: any) => ref === collection ? snapshot() : { exists: records.has(ref.id), data: () => records.get(ref.id) },
      set: (ref: any, data: any) => writes.push(() => { records.set(ref.id, data); }),
      update: (ref: any, data: any) => writes.push(() => { records.set(ref.id, { ...records.get(ref.id), ...data }); }),
    });
    writes.forEach(write => write()); return result;
  }) };
  const app = express(); app.use(express.json());
  registerProductTagRoutes(app, prefix, (req: any, res: any, next: any) => req.headers.authorization === 'owner' ? next() : res.status(401).end(), () => db);
  return { app, db, records, get, path: `${prefix}/admin/product-categories` };
}
describe.each(['', '/api'])('Product tags adapter %s', prefix => {
  it('returns an array including records without a sort order and writes the same collection', async () => {
    const f = fixture(prefix);
    const loaded = await request(f.app).get(f.path).set('Authorization', 'owner');
    expect(loaded.body).toEqual([{ id: 'old', name: 'Legacy', slug: 'legacy', isActive: false }]);
    const result = await request(f.app).put(`${f.path}/old`).set('Authorization', 'owner').send({ isActive: true });
    expect(result.status).toBe(200); expect(f.records.get('old').isActive).toBe(true);
    expect(f.db.collection.mock.calls.every(args => args[0] === 'productCategories')).toBe(true);
  });
  it('seeds taxonomy defaults once and preserves disabled existing records', async () => {
    const f = fixture(prefix); f.records.set('spring', { ...DEFAULT_PRODUCT_TAGS[0], isActive: false });
    const seeded = await request(f.app).post(`${f.path}/seed`).set('Authorization', 'owner');
    expect(seeded.body.created).toBe(DEFAULT_PRODUCT_TAGS.length - 1);
    expect((await request(f.app).post(`${f.path}/seed`).set('Authorization', 'owner')).body.created).toBe(0);
    expect(f.records.get('spring').isActive).toBe(false);
    expect(Array.from(f.records.values()).filter(tag => tag.taxonomyType === 'season')).toHaveLength(4);
  });
  it('rejects invalid toggles and missing IDs', async () => {
    const f = fixture(prefix);
    expect((await request(f.app).put(`${f.path}/old`).set('Authorization', 'owner').send({ isActive: 'yes' })).status).toBe(400);
    expect((await request(f.app).put(`${f.path}/missing`).set('Authorization', 'owner').send({ isActive: true })).status).toBe(404);
    expect(f.records.get('old').isActive).toBe(false);
  });
  it('requires admin access on all three operations and surfaces failures', async () => {
    const f = fixture(prefix);
    expect((await request(f.app).get(f.path)).status).toBe(401);
    expect((await request(f.app).post(`${f.path}/seed`)).status).toBe(401);
    expect((await request(f.app).put(`${f.path}/old`).send({ isActive: true })).status).toBe(401);
    f.get.mockRejectedValueOnce(new Error('Offline'));
    expect((await request(f.app).get(f.path).set('Authorization', 'owner')).status).toBe(500);
    f.db.runTransaction.mockRejectedValueOnce(new Error('Offline'));
    expect((await request(f.app).post(`${f.path}/seed`).set('Authorization', 'owner')).status).toBe(500);
    f.db.runTransaction.mockRejectedValueOnce(new Error('Offline'));
    expect((await request(f.app).put(`${f.path}/old`).set('Authorization', 'owner').send({ isActive: true })).status).toBe(500);
  });
});
