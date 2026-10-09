import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buildPacketImageOrder, instanceCatalogImages, resolveCatalogImages } from '../../../../shared/productImages';

const m = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, any>>, writes: [] as any[] }));
vi.mock('../../core', () => {
  const ref = (collection: string, id: string): any => ({ id,
    get: async () => ({ id, exists: !!m.rows[collection]?.[id], data: () => m.rows[collection]?.[id] }),
    update: async (data: any) => {
      m.writes.push({ collection, id, data });
      const row = m.rows[collection][id];
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split('.'); let parent = row;
        for (const key of keys.slice(0, -1)) parent = (parent[key] ||= {});
        parent[keys[keys.length - 1]] = value;
      }
    },
  });
  return { db: { collection: (name: string) => ({ doc: (id: string) => ref(name, id) }),
    runTransaction: async (fn: any) => fn({ get: (r: any) => r.get(), update: (r: any, data: any) => r.update(data) }) },
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'now' } } } };
});
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../services/qrg-instance-allocator', () => ({}));
vi.mock('../../services/printful', () => ({}));
vi.mock('../../services/printify', () => ({}));
vi.mock('../../services/storage-helpers', () => ({}));
vi.mock('../../services/pricing', () => ({}));
vi.mock('../../services/mockup-generator', () => ({}));
vi.mock('../../services/email', () => ({}));
vi.mock('../../services/composite-image', () => ({}));
import { register as registerInstances } from '../../routes/admin-catalog-instances';
import { register as registerCatalogs } from '../../routes/catalog';
const app = express(); app.use(express.json()); registerInstances(app); registerCatalogs(app);
beforeEach(() => {
  m.writes = [];
  m.rows = {
    master_catalog: { qrg_11111: { images: ['keep', 'removed'] } },
    catalogs: { primary: { blankIds: ['qrg_11111'], blankImages: { qrg_11111: ['keep'] } } },
    admin_catalog_instances: { product: { currentPacketId: 'packet', baseSnapshot: { images: ['keep'] }, resolved: { images: ['old-generated', 'keep'] } } },
    productPackets: { packet: { lifestyleMockupUrl: 'lifestyle', placementMockupUrls: { back: 'back', front: 'front' }, compositeUrl: 'artwork', landingPageSnapshotUrl: 'proof' } },
  };
});

describe('Image layers through catalog and product routes', () => {
  it('shows only generated product images and proofs while preserving catalog selections', async () => {
    const res = await request(app).post('/admin/catalog-instances/product/rebuild-images').send({});
    expect(res.status).toBe(200);
    expect(m.rows.admin_catalog_instances.product.resolved.images).toEqual(['front', 'back', 'lifestyle', 'artwork', 'proof']);
    expect(m.rows.admin_catalog_instances.product.baseSnapshot.images).toEqual(['keep']);
    expect(m.rows.catalogs.primary.blankImages.qrg_11111).toEqual(['keep']);
    expect(m.rows.master_catalog.qrg_11111.images).toEqual(['keep', 'removed']);
    expect(m.writes.every(write => !('baseSnapshot.images' in write.data))).toBe(true);
  });
  it('regenerates without accumulating old mockups or changing the saved catalog photos', async () => {
    await request(app).post('/admin/catalog-instances/product/rebuild-images').send({});
    m.rows.productPackets.packet = { priorityMockupUrl: 'new-mockup', compositeUrl: 'new-artwork' };
    await request(app).post('/admin/catalog-instances/product/rebuild-images').send({});
    expect(m.rows.admin_catalog_instances.product.resolved.images).toEqual(['new-mockup', 'new-artwork']);
    expect(instanceCatalogImages(m.rows.admin_catalog_instances.product)).toEqual(['keep']);
  });
  it('does not substitute catalog photos when generation has no images', async () => {
    m.rows.productPackets.packet = {};
    await request(app).post('/admin/catalog-instances/product/rebuild-images').send({});
    expect(m.rows.admin_catalog_instances.product.resolved.images).toEqual([]);
    m.rows.admin_catalog_instances.product.baseSnapshot.images = [];
    await request(app).post('/admin/catalog-instances/product/rebuild-images').send({});
    expect(m.rows.admin_catalog_instances.product.resolved.images).toEqual([]);
  });
  it('persists removal of the final image; only explicit Restore removes that override', async () => {
    let res = await request(app).put('/admin/catalogs/primary/blank-images').send({ blankId: 'qrg_11111', images: [] });
    expect(res.status).toBe(200);
    expect(m.rows.catalogs.primary.blankImages.qrg_11111).toEqual([]);
    expect(resolveCatalogImages(['keep', 'removed'], m.rows.catalogs.primary.blankImages.qrg_11111)).toEqual([]);
    res = await request(app).put('/admin/catalogs/primary/blank-images').send({ blankId: 'qrg_11111', images: [], restore: true });
    expect(res.status).toBe(200);
    expect(m.rows.catalogs.primary.blankImages).not.toHaveProperty('qrg_11111');
    expect(resolveCatalogImages(['keep', 'removed'], m.rows.catalogs.primary.blankImages.qrg_11111)).toEqual(['keep', 'removed']);
  });
  it('deduplicates generated mockups and proofs', () => {
    expect(buildPacketImageOrder({ lifestyleMockupUrl: 'same', priorityMockupUrl: 'same', compositeUrl: 'art', sleeveCompositeUrls: { left_sleeve: 'left', right_sleeve: 'right' }, sleeveCompositeUrl: 'left' }, [{ url: 'same' }, { url: 'extra-mockup' }, 'extra-mockup'])).toEqual(['same', 'extra-mockup', 'art', 'left', 'right']);
  });
});
