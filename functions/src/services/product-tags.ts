import { DEFAULT_PRODUCT_TAGS, PRODUCT_TAG_COLLECTION } from '../../../shared/productTags';
import { insertProductCategorySchema } from '../../../shared/schema';

/** Tags use the existing product category records in both HTTP adapters. */
export function registerProductTagRoutes(app: any, prefix: string, auth: any, getDb: () => any) {
  const path = `${prefix}/admin/product-categories`;
  app.get(path, auth, async (_req: any, res: any) => {
    try {
      // Do not orderBy here: older records without sortOrder must remain visible.
      const snapshot = await getDb().collection(PRODUCT_TAG_COLLECTION).get();
      const tags = snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id }));
      res.json(tags.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  app.put(`${path}/:id`, auth, async (req: any, res: any) => {
    const parsed = insertProductCategorySchema.partial().strict().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid tag fields' }); return; }
    try {
      const ref = getDb().collection(PRODUCT_TAG_COLLECTION).doc(req.params.id);
      const updated = await getDb().runTransaction(async (tx: any) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return null;
        tx.update(ref, parsed.data);
        return { ...snapshot.data(), ...parsed.data, id: ref.id };
      });
      if (!updated) { res.status(404).json({ error: 'Tag not found' }); return; }
      res.json(updated);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  app.post(`${path}/seed`, auth, async (_req: any, res: any) => {
    try {
      const db = getDb();
      const collection = db.collection(PRODUCT_TAG_COLLECTION);
      const created = await db.runTransaction(async (tx: any) => {
        const snapshot = await tx.get(collection);
        const slugs = new Set(snapshot.docs.map((doc: any) => doc.data().slug));
        const missing = DEFAULT_PRODUCT_TAGS.filter(tag => !slugs.has(tag.slug));
        for (const tag of missing) {
          const ref = collection.doc();
          tx.set(ref, { ...tag, isActive: true, createdAt: new Date().toISOString() });
        }
        return missing.length;
      });
      res.json({ created });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
}
