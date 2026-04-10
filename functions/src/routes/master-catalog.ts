import { Request, Response } from 'express';
import express from 'express';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import { syncMasterCatalog, MASTER_CATALOG_COLLECTION, MASTER_CATALOG_SYNCS_COLLECTION } from '../services/master-catalog';

export function register(app: express.Express): void {

  // POST /admin/master-catalog/sync — trigger a full sync (runs synchronously)
  app.post('/admin/master-catalog/sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const startedAt = new Date().toISOString();
    try {
      const forceRefresh = req.body?.forceRefresh === true;
      console.log('[MasterCatalog] Sync requested, running synchronously...');

      const result = await syncMasterCatalog({ forceRefresh });

      await db.collection(MASTER_CATALOG_SYNCS_COLLECTION).add({
        status: 'completed',
        ...result,
        startedAt,
        completedAt: new Date().toISOString(),
      });

      console.log('[MasterCatalog] Sync complete:', result);
      res.json({ success: true, message: 'Master catalog sync complete', startedAt, completedAt: new Date().toISOString(), ...result });
    } catch (error: any) {
      console.error('[MasterCatalog] Sync error:', error.message);
      await db.collection(MASTER_CATALOG_SYNCS_COLLECTION).add({
        status: 'failed',
        error: error.message,
        startedAt,
        completedAt: new Date().toISOString(),
      }).catch(() => {});
      res.status(500).json({ error: error.message });
    }
  });

  // GET /admin/master-catalog/sync-status — latest sync result + total count
  app.get('/admin/master-catalog/sync-status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
      const [syncSnap, countSnap] = await Promise.all([
        db.collection(MASTER_CATALOG_SYNCS_COLLECTION).orderBy('completedAt', 'desc').limit(1).get(),
        db.collection(MASTER_CATALOG_COLLECTION).count().get(),
      ]);
      const latest = syncSnap.docs[0] ? { id: syncSnap.docs[0].id, ...syncSnap.docs[0].data() } : null;
      res.json({ latest, totalProducts: countSnap.data().count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /admin/master-catalog/products — paginated list with optional search
  app.get('/admin/master-catalog/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '50')), 200);
      const offset = parseInt(String(req.query.offset || '0'));
      const search = String(req.query.search || '').toLowerCase().trim();

      const snap = await db.collection(MASTER_CATALOG_COLLECTION).orderBy('title').get();
      let products: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (search) {
        products = products.filter(p =>
          (p.title || '').toLowerCase().includes(search) ||
          (p.brand || '').toLowerCase().includes(search) ||
          (p.description || '').toLowerCase().includes(search)
        );
      }

      const total = products.length;
      res.json({ products: products.slice(offset, offset + limit), total, limit, offset });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /admin/master-catalog/products/:id — single product
  app.get('/admin/master-catalog/products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const doc = await db.collection(MASTER_CATALOG_COLLECTION).doc(req.params.id).get();
      if (!doc.exists) { res.status(404).json({ error: 'Product not found' }); return; }
      res.json({ id: doc.id, ...doc.data() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /admin/master-catalog/products/:id — admin manual edits
  app.patch('/admin/master-catalog/products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const doc = await db.collection(MASTER_CATALOG_COLLECTION).doc(id).get();
      if (!doc.exists) { res.status(404).json({ error: 'Product not found' }); return; }

      const allowed = ['title', 'description', 'brand', 'images', 'colors', 'sizes', 'originCountry', 'category', 'minPrice', 'maxPrice'];
      const updates: any = { updatedAt: new Date().toISOString() };
      for (const field of allowed) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      await db.collection(MASTER_CATALOG_COLLECTION).doc(id).update(updates);
      const updated = await db.collection(MASTER_CATALOG_COLLECTION).doc(id).get();
      res.json({ id: updated.id, ...updated.data() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
