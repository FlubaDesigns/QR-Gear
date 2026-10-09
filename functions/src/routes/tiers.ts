import type { Request, Response } from 'express';
import type express from 'express';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import { catalogTierProducts } from '../services/catalog-tier-products';
import { CATALOG_SECTIONS } from '../../../shared/catalogs';

  export function register(app: express.Express): void {
  // ============ TIER MANAGEMENT ============

app.get('/members/tier-products', async (req: Request, res: Response): Promise<void> => {
  try { res.json(await catalogTierProducts(db, String(req.query.section || 'member'))); }
  catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
});

app.get('/catalog-for-section/:section', async (req: Request, res: Response): Promise<void> => {
  try {
    const { section } = req.params;
    const validSections = CATALOG_SECTIONS as readonly string[];
    if (!validSections.includes(section)) { res.status(400).json({ error: `Invalid section. Must be one of: ${validSections.join(', ')}` }); return; }
    const assignDoc = await db.collection('systemSettings').doc('catalog-assignments').get();
    const catalogId = assignDoc.exists ? assignDoc.data()?.[section] : null;
    if (!catalogId) {
      res.json({ catalog: null, blanks: [], message: `No catalog assigned to "${section}"` });
      return;
    }
    const catDoc = await db.collection('catalogs').doc(catalogId).get();
    if (!catDoc.exists) {
      res.json({ catalog: null, blanks: [], message: `Assigned catalog not found` });
      return;
    }
    const catData = catDoc.data() || {};
    const catalog = { id: catDoc.id, ...catData };
    res.json({ catalog, blanks: catData.blankIds || [] });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog-health', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [productsSnap, allowedDoc, catalogsSnap, assignDoc] = await Promise.all([
      db.collection('products').get(),
      db.collection('storeAllowedProducts').doc('member-products').get(),
      db.collection('catalogs').get(),
      db.collection('systemSettings').doc('catalog-assignments').get(),
    ]);

    const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const enabledProducts = allProducts.filter((p: any) => p.isEnabled !== false);
    const allowedProducts = allowedDoc.exists ? (allowedDoc.data()?.products || []) : [];
    const providers = [...new Set(allProducts.map((p: any) => p.provider || 'unknown'))];

    const catalogs = catalogsSnap.docs.map(d => {
      const data = d.data();
      return { id: d.id, name: data.name, blankCount: (data.blankIds || []).length };
    });

    const assignments = assignDoc.exists ? assignDoc.data() : {};
    const sections = CATALOG_SECTIONS as readonly string[];
    const sectionStatus: Record<string, any> = {};
    for (const s of sections) {
      const catId = assignments?.[s] || null;
      const cat = catId ? catalogs.find(c => c.id === catId) : null;
      sectionStatus[s] = {
        catalogId: catId,
        catalogName: cat?.name || null,
        blankCount: cat?.blankCount || 0,
        status: catId ? (cat ? 'assigned' : 'missing-catalog') : 'unassigned',
      };
    }

    res.json({
      totalProducts: allProducts.length,
      enabledProducts: enabledProducts.length,
      allowedMemberProducts: allowedProducts.length,
      providers,
      catalogs,
      sections: sectionStatus,
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


  }
  