import express, { Request, Response } from 'express';
import { admin, db, docToObject, docsToArray } from '../core';
import { requireAuth } from '../middleware';
import { readOwnedDocument } from '../services/owned-document';

const editableFields = ['projectName', 'productId', 'productName', 'productImage', 'placements', 'placementConfigs', 'placementImages', 'backgroundImageUrl', 'backgroundAssetId', 'topText', 'bottomText', 'landingOverlay', 'templateVariant', 'externalUrl', 'templateName', 'templateCategory', 'templateSubcategory', 'campaignName', 'selectedColors', 'defaultColor', 'graphicsConfig', 'selectedVariantIds'];
function editable(body: any): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Invalid design'), { status: 400 });
  return Object.fromEntries(editableFields.filter(key => Object.prototype.hasOwnProperty.call(body, key)).map(key => [key, body[key]]));
}
const ownedDesign = (tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference, uid: string) => readOwnedDocument(tx, ref, uid, ['userId', 'ownerUserId']);
export function register(app: express.Express): void {
  app.get('/designs', requireAuth, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    try { res.json(docsToArray(await db.collection('customDesigns').where('userId', '==', (req as any).user.uid).orderBy('createdAt', 'desc').get())); }
    catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
  });
  app.get('/designs/:id', requireAuth, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const doc = await db.runTransaction(tx => ownedDesign(tx, db.collection('customDesigns').doc(req.params.id), (req as any).user.uid));
      res.json(docToObject(doc));
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
  });
  app.post('/designs', requireAuth, async (req: Request, res: Response) => {
    try {
      const ref = await db.collection('customDesigns').add({ ...editable(req.body), userId: (req as any).user.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      res.json(docToObject(await ref.get()));
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
  });
  app.put('/designs/:id', requireAuth, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const ref = db.collection('customDesigns').doc(req.params.id);
      const data = await db.runTransaction(async tx => {
        const doc = await ownedDesign(tx, ref, (req as any).user.uid);
        const patch = { ...editable(req.body), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        tx.update(ref, patch);
        return { ...doc.data(), ...patch, id: doc.id };
      });
      res.json(data);
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
  });
  app.delete('/designs/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const ref = db.collection('customDesigns').doc(req.params.id);
      await db.runTransaction(async tx => { await ownedDesign(tx, ref, (req as any).user.uid); tx.delete(ref); });
      res.json({ success: true });
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
  });
}
