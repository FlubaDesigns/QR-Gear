import type { Express, Request, Response } from "express";
import { isAdmin } from "../firebaseAuth";

const MASTER_CATALOG_COLLECTION = 'master_catalog';

async function resolveProductCanonical(qrgCode: string) {
  const { getFirestoreDb } = await import("../lib/firebase-admin");
  const db = getFirestoreDb();
  const docId = `qrg_${qrgCode.replace(/^QRG-/, '')}`;

  const doc = await db.collection(MASTER_CATALOG_COLLECTION).doc(docId).get();
  if (!doc.exists) throw new Error(`Product not found: ${qrgCode}`);

  const data = doc.data() as any;
  const pm = data.providerMappings;

  const product: any = {
    qrgCode,
    qrgBlankId: data.qrgBlankId || qrgCode.replace(/^QRG-/, ''),
    title: data.title || data.canonicalTitle || 'Untitled Product',
    description: data.description || null,
    brand: data.brand || null,
    category: data.category || 'Unclassified',
    subCategory: data.qrgCategory || 'Unclassified',
    images: data.images || [],
    printifyImages: data.printifyImages || [],
    printfulImages: data.printfulImages || [],
    colors: (data.colors || []).map((c: any) => ({ name: c.name || c.label || '', code: c.code || c.value || '' })),
    sizes: (data.sizes || []).map((s: any) => ({ name: s.name || s.label || '', code: s.code || s.value || '' })),
    pricing: { minPrice: data.minPrice || 0, maxPrice: data.maxPrice || 0, currency: 'USD' },
    availability: {
      availableVia: data.availableVia || [],
      printifyAvailable: (data.availableVia || []).includes('Printify'),
      printfulAvailable: (data.availableVia || []).includes('Printful'),
    },
    metadata: {
      originCountry: data.originCountry || null,
      weight: data.weight || null,
      dimensions: data.dimensions || null,
      lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
    },
    providers: {} as any,
  };

  if (pm && typeof pm === 'object' && !Array.isArray(pm)) {
    if (pm.printify) {
      product.providers.printify = {
        blueprintId: String(pm.printify.blueprintId || ''),
        title: pm.printify.title || product.title,
        productId: String(pm.printify.productId || ''),
      };
    }
    if (pm.printful) {
      product.providers.printful = {
        productId: String(pm.printful.productId || ''),
        title: pm.printful.title || product.title,
      };
    }
  }

  return product;
}

export function registerProductsCanonicalRoutes(app: Express): void {
  app.get('/api/products/canonical/:qrgCode', async (req: Request, res: Response) => {
    try {
      const { qrgCode } = req.params;
      const context = (req.query.context || 'external') as string;
      const memberId = req.query.memberId as string | undefined;
      const ownerId = req.query.ownerId as string | undefined;

      if (!['admin', 'member', 'owner', 'external', 'marketplace'].includes(context)) {
        res.status(400).json({ error: 'Invalid context parameter' });
        return;
      }

      if (context === 'admin') {
        const user = (req as any).user;
        if (!user?.admin) { res.status(403).json({ error: 'Admin access required' }); return; }
      }

      if (context === 'owner' && !ownerId) {
        res.status(400).json({ error: 'ownerId required for owner context' });
        return;
      }

      if (context === 'marketplace' && !req.query.provider) {
        res.status(400).json({ error: 'provider required for marketplace context' });
        return;
      }

      const product = await resolveProductCanonical(qrgCode);
      res.json({ success: true, context, product, resolvedAt: new Date().toISOString() });
    } catch (error: any) {
      if (error.message.includes('Product not found')) {
        res.status(404).json({ error: error.message });
      } else {
        console.error('[ProductsCanonical] Error:', error);
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post('/api/products/canonical/batch', async (req: Request, res: Response) => {
    try {
      const { qrgCodes, context, memberId, ownerId, provider } = req.body;

      if (!Array.isArray(qrgCodes) || qrgCodes.length === 0) {
        res.status(400).json({ error: 'qrgCodes array required' }); return;
      }
      if (!context) { res.status(400).json({ error: 'context required' }); return; }

      if (context === 'admin') {
        const user = (req as any).user;
        if (!user?.admin) { res.status(403).json({ error: 'Admin access required' }); return; }
      }

      const results = await Promise.allSettled(qrgCodes.map((qrgCode) => resolveProductCanonical(qrgCode)));

      const products: any[] = [];
      const errors: Array<{ qrgCode: string; error: string }> = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          products.push(result.value);
        } else {
          errors.push({ qrgCode: qrgCodes[i], error: (result as any).reason?.message || 'Unknown error' });
        }
      }

      res.json({ success: true, context, products, errors, count: products.length, failureCount: errors.length, resolvedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error('[ProductsCanonical/Batch] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
