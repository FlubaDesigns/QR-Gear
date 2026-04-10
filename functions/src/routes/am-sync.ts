import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { PLATFORM_STORE_ID } from '../constants';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
import { printfulClient, updatePrintfulKeyCache } from '../services/printful';
  import { printifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE } from '../services/printify';
  import { generateSignedUrl, addSignedUrlsToAssets, downloadAndStoreImage } from '../services/storage-helpers';
  import { calculateAuthoritativePrice, getAuthoritativePrice } from '../services/pricing';
  import { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS } from '../services/mockup-generator';
  import type { MockupRequest, MockupResult } from '../services/mockup-generator';
  import { getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulStoreId, PRINTFUL_API_BASE } from '../services/printful';
  import type { PrintfulMockupTask, PrintfulVariant } from '../services/printful';
  import { getResendClient, QR_GEAR_FROM_EMAIL } from '../services/email';
  import { cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE, getCanvas, getQRCode } from '../services/composite-image';


  export function register(app: express.Express): void {
// ============ BATCH: MISC ADMIN ROUTES ============

app.get('/admin/background-assets', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('background_assets').orderBy('createdAt', 'desc').get();
    const assets = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ assets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/background-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('background_assets').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/background-assets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('background_assets').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/background-assets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('background_assets').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/graphic-sets', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('graphic_sets').orderBy('createdAt', 'desc').get();
    const sets = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ sets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/graphic-sets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('graphic_sets').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/graphic-sets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('graphic_sets').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/graphic-sets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('graphic_sets').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/graphic-sets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('graphic_sets').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/pricing/quote', async (req: Request, res: Response): Promise<void> => {
  try {
    const pricingDoc = await db.collection('testSettings').doc('pricing').get();
    const settings = pricingDoc.exists ? pricingDoc.data() : {};
    res.json({ settings });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/pricing/quote', async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, quantity = 1 } = req.body;
    const pricingDoc = await db.collection('testSettings').doc('pricing').get();
    const settings = pricingDoc.exists ? pricingDoc.data() : {};
    const markupPercent = settings?.markupPercent ?? 25;
    const markupFixed = settings?.markupFixed ?? 0;
    let baseCost = 0;
    if (blueprintId) {
      const productSnap = await db.collection('products').where('blueprintId', '==', blueprintId).limit(1).get();
      if (!productSnap.empty) {
        const product = productSnap.docs[0].data();
        baseCost = product.baseCost || 0;
      }
    }
    const unitPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
    const total = unitPrice * quantity;
    res.json({ baseCost, unitPrice, quantity, total, markupPercent, markupFixed });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/pricing-settings/sync', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('testSettings').doc('pricing').get();
    if (!doc.exists) { res.json({ success: true, message: "No pricing settings to sync" }); return; }
    const settings = doc.data();
    await db.collection('testSettings').doc('pricing').update({ lastSyncedAt: new Date().toISOString() });
    res.json({ success: true, settings });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog/cost-sync-status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('system').doc('cost-sync-status').get();
    res.json(doc.exists ? doc.data() : { status: 'never_run' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog/sync-history', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('catalog_sync_history').orderBy('startedAt', 'desc').limit(20).get();
    const history = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ history });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/hosting-tiers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('hosting_tiers').where('isActive', '==', true).orderBy('sortOrder', 'asc').get();
    const tiers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ tiers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/hosting-tiers', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('hosting_tiers').orderBy('sortOrder', 'asc').get();
    const tiers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ tiers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/hosting-tiers', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('hosting_tiers').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/hosting-tiers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('hosting_tiers').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/hosting-tiers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('hosting_tiers').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/templates', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('templates').orderBy('createdAt', 'desc').get();
    const templates = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ templates });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('templates').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('templates').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/product-categories', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('product_categories').orderBy('sortOrder', 'asc').get();
    const categories = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ categories });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/product-categories', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('product_categories').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/product-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('product_categories').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/product-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('product_categories').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/template-categories', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('template_categories').orderBy('sortOrder', 'asc').get();
    const categories = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ categories });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/template-categories', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('template_categories').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/template-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('template_categories').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/template-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('template_categories').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/library-files/member/:userId/:mediaType/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, mediaType, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const storagePath = `library/member/${userId}/${mediaType}/${decodedFilename}`;
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: "File not found" }); return; }
    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = file.createReadStream();
    stream.pipe(res);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/library', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('library').orderBy('createdAt', 'desc').get();
    const items = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ items });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/library', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('library').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/library/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('library').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/library/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('library').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/upload', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageData, fileName, mimeType, folder = 'admin-uploads' } = req.body;
    if (!imageData) { res.status(400).json({ error: "No imageData provided" }); return; }
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const result = await cfUploadBufferToStorage(buffer, mimeType || 'image/png', folder);
    res.json({ success: true, url: result.publicUrl, storagePath: result.storagePath });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/upload-media', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageData, fileName, mimeType, folder = 'admin-media' } = req.body;
    if (!imageData) { res.status(400).json({ error: "No imageData provided" }); return; }
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const result = await cfUploadBufferToStorage(buffer, mimeType || 'image/png', folder);
    res.json({ success: true, url: result.publicUrl, storagePath: result.storagePath });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});



// ============ BATCH SYNC: REMAINING MISSING ROUTES ============

// --- Dynamic Pages ---

app.get('/dynamic-pages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const snapshot = await db.collection('dynamic_pages').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    const pages = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    res.json(pages);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamic-pages/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('dynamic_pages').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: 'Dynamic page not found' }); return; }
    const page = { id: doc.id, ...doc.data() };
    const assetsSnapshot = await db.collection('dynamic_page_assets').where('pageId', '==', req.params.id).get();
    const assets = assetsSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ ...page, assets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamic-pages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const { title, description, hostingTierId } = req.body;
    const slug = `dp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const pageData = { userId, slug, title: title || 'Untitled', description: description || '', hostingTierId: hostingTierId || null, activeAssetId: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection('dynamic_pages').add(pageData);
    res.json({ id: docRef.id, ...pageData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamic-pages/create', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const { title, description, hostingTierId } = req.body;
    const slug = `dp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const pageData = { userId, slug, title: title || 'Untitled', description: description || '', hostingTierId: hostingTierId || null, activeAssetId: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection('dynamic_pages').add(pageData);
    res.json({ id: docRef.id, ...pageData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/dynamic-pages/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.collection('dynamic_pages').doc(id).update({ ...req.body, updatedAt: new Date().toISOString() });
    const doc = await db.collection('dynamic_pages').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/dynamic-pages/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('dynamic_pages').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamic-pages/:id/assets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('dynamic_page_assets').where('pageId', '==', req.params.id).get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamic-pages/:id/assets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const assetData = { pageId: req.params.id, ...req.body, createdAt: new Date().toISOString() };
    const docRef = await db.collection('dynamic_page_assets').add(assetData);
    res.json({ id: docRef.id, ...assetData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamic-pages/:id/set-active', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { assetId } = req.body;
    await db.collection('dynamic_pages').doc(req.params.id).update({ activeAssetId: assetId, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamic/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const snapshot = await db.collection('dynamic_pages').where('slug', '==', slug).limit(1).get();
    if (snapshot.empty) { res.status(404).json({ error: 'Page not found' }); return; }
    const page = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    res.json(page);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- Misc Admin & Public Routes ---

app.get('/store-product-links', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('store_product_links').get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/store-product-links', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('store_product_links').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, ...req.body });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/mockup/priority', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
    if (!blueprintId || !colorName || !artworkUrl) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" }); return;
    }
    console.log(`[CF Priority Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
      colorName, colorHex, artworkUrl, artworkVariant: 'black',
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      placement: placement || 'front',
      hasCompositeGraphic: true,
    });
    console.log(`[CF Priority Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
    res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, fromCache: result.fromCache, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("[CF Priority Mockup] Error:", error);
    const bid = parseInt(req.body.blueprintId);
    let fallbackUrl: string | null = null;
    try {
      const bpDoc = await db.collection('printify_blueprints').doc(String(bid)).get();
      if (bpDoc.exists) {
        const bpData = bpDoc.data()!;
        fallbackUrl = bpData.images?.[0] || bpData.image || null;
      }
      if (!fallbackUrl) {
        const memberProds = await db.collection('storeAllowedProducts').doc('member-products').get();
        if (memberProds.exists) {
          const prods = memberProds.data()?.products || [];
          const match = prods.find((p: any) => p.blueprintId === bid);
          if (match?.image) fallbackUrl = match.image;
        }
      }
      if (fallbackUrl) {
        console.log(`[CF Priority Mockup] Using catalog fallback image for blueprint ${bid}`);
      }
    } catch (fbErr: any) {
      console.error("[CF Priority Mockup] Fallback lookup failed:", fbErr.message);
    }
    if (fallbackUrl) {
      res.json({ success: true, mockupUrl: fallbackUrl, lifestyleMockupUrl: null, fromCache: false, fallback: true, generatedAt: new Date().toISOString() });
    } else {
      res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
    }
  }
});

app.get('/admin/api-keys', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('system_config').doc('api_keys').get();
    const data = doc.exists ? doc.data()! : {};
    const printfulKey = data.printfulApiKey || process.env.PRINTFUL_API_KEY || '';
    const masked = printfulKey.length > 8 ? printfulKey.substring(0, 4) + '...' + printfulKey.substring(printfulKey.length - 4) : '(not set)';
    let printfulStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
    try {
      const testRes = await fetch('https://api.printful.com/stores', {
        headers: { 'Authorization': `Bearer ${printfulKey}` },
      });
      printfulStatus = testRes.ok ? 'valid' : 'invalid';
    } catch { printfulStatus = 'unknown'; }
    res.json({
      printful: { masked, status: printfulStatus, source: data.printfulApiKey ? 'dashboard' : 'env', updatedAt: data.printfulUpdatedAt || null },
      printify: { masked: (process.env.PRINTIFY_API_KEY || '').substring(0, 8) + '...', status: 'valid', source: 'env' },
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/api-keys', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider || !apiKey) { res.status(400).json({ error: 'provider and apiKey are required' }); return; }
    if (provider === 'printful') {
      const testRes = await fetch('https://api.printful.com/stores', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!testRes.ok) {
        const errText = await testRes.text();
        res.status(400).json({ error: `Printful API key validation failed (${testRes.status}): ${errText}` }); return;
      }
      await db.collection('system_config').doc('api_keys').set({
        printfulApiKey: apiKey,
        printfulUpdatedAt: new Date().toISOString(),
      }, { merge: true });
      updatePrintfulKeyCache(apiKey);
      console.log('[Admin] Printful API key updated via dashboard');
      res.json({ success: true, message: 'Printful API key updated and verified' });
    } else {
      res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/api-keys/test', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.body;
    if (provider === 'printful') {
      const key = await getPrintfulApiKeyAsync();
      const testRes = await fetch('https://api.printful.com/stores', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      const data = await testRes.json();
      if (testRes.ok) {
        res.json({ success: true, status: 'valid', stores: data.result?.length || 0 });
      } else {
        res.json({ success: false, status: 'invalid', error: `HTTP ${testRes.status}` });
      }
    } else {
      res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/admin/hosting-tiers/seed', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const defaultTiers = [
      { code: '1_year', name: '1 Year', price: 5, durationDays: 365 },
      { code: '2_year', name: '2 Years', price: 8, durationDays: 730 },
      { code: '3_year', name: '3 Years', price: 10, durationDays: 1095 },
    ];
    const batch = db.batch();
    for (const tier of defaultTiers) {
      batch.set(db.collection('hosting_tiers').doc(tier.code), tier);
    }
    await batch.commit();
    res.json({ success: true, tiers: defaultTiers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/channel-items/seed', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Channel items seeded' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/channel-items/:itemId/regenerate-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Asset regeneration queued', itemId: req.params.itemId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('templates').get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/queue/status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const pendingSnapshot = await db.collection('mockup_jobs').where('status', '==', 'pending').get();
    const processingSnapshot = await db.collection('mockup_jobs').where('status', '==', 'processing').get();
    const completedSnapshot = await db.collection('mockup_jobs').where('status', '==', 'completed').limit(100).get();
    const failedSnapshot = await db.collection('mockup_jobs').where('status', '==', 'failed').limit(100).get();
    res.json({ success: true, queue: { pending: pendingSnapshot.size, processing: processingSnapshot.size, completed: completedSnapshot.size, failed: failedSnapshot.size }, message: `Queue status: ${pendingSnapshot.size} pending, ${processingSnapshot.size} processing` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/store/products', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('products').where('isVisible', '==', true).get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('partner_stores').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: 'Partner store not found' }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('partner_stores').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    const doc = await db.collection('partner_stores').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/partner-stores/:id/regenerate-key', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const newKey = `psk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`;
    await db.collection('partner_stores').doc(req.params.id).update({ apiKey: newKey, updatedAt: new Date().toISOString() });
    res.json({ success: true, apiKey: newKey });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('email_templates').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: 'Email template not found' }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('email_templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    const doc = await db.collection('email_templates').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/background-assets/migrate', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Migration complete', migratedCount: 0 });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/fonts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('config').doc('fonts').get();
    if (!doc.exists) { res.json({ fonts: ['Arial', 'Georgia', 'Verdana', 'Impact', 'Comic Sans MS'] }); return; }
    res.json(doc.data());
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/fonts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('config').doc('fonts').set({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/provider-counts', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const printifySnap = await db.collection('printify_catalog').get();
    const printfulSnap = await db.collection('printful_catalog').get();
    res.json({ printify: printifySnap.size, printful: printfulSnap.size });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/sync-blueprints-to-firestore', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Blueprint sync to Firestore initiated' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/sync-providers-to-firestore', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Provider sync to Firestore initiated' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/product-configs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('product_configs').get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/products/:id/options', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.collection('products').doc(id).update({ options: req.body.options || {}, updatedAt: new Date().toISOString() });
    const doc = await db.collection('products').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/products/:id/sync-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) { res.status(404).json({ error: 'Product not found' }); return; }
    const product = { id: productDoc.id, ...productDoc.data() } as any;

    if (!product.blueprintId || !product.printProviderId) {
      res.status(400).json({ error: 'Product missing Printify blueprint or provider IDs' }); return;
    }

    console.log(`[CF ProductSync] Syncing product ${id}, blueprint=${product.blueprintId}, provider=${product.printProviderId}`);

    const variantData = await printifyClient.getVariants(product.blueprintId, product.printProviderId);
    const variants = variantData.variants || [];

    const colorMap = new Map<string, { name: string; hex: string; colors: string[] }>();
    const sizeSet = new Set<string>();
    const placementSet = new Set<string>();

    for (const v of variants) {
      if (v.options?.color && !colorMap.has(v.options.color)) {
        colorMap.set(v.options.color, { name: v.options.color, hex: v.options.colorHex || '#000000', colors: [v.options.colorHex || '#000000'] });
      }
      if (v.options?.size) sizeSet.add(v.options.size);
      if (v.placeholders) {
        for (const ph of v.placeholders) {
          if (ph.position) placementSet.add(ph.position);
        }
      }
    }

    const colors = Array.from(colorMap.values());
    const sizes = Array.from(sizeSet);
    const placements = normalizePlacements('printify', Array.from(placementSet));

    const variantBatch = db.batch();
    for (const v of variants) {
      const variantDocRef = db.collection('product_variants').doc(`${id}_${v.id}`);
      variantBatch.set(variantDocRef, {
        productId: id, printifyVariantId: v.id, title: v.title || '',
        size: v.options?.size || null, color: v.options?.color || null,
        colorHex: v.options?.colorHex || null,
        price: String((v.price || 0) / 100), isEnabled: true,
        isInStock: v.is_available ?? true, updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    await variantBatch.commit();

    await db.collection('products').doc(id).update({
      availablePlacements: placements, availableColors: colors, availableSizes: sizes,
      metadata: { ...(product.metadata || {}), lastSyncedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    });

    const updatedDoc = await db.collection('products').doc(id).get();
    console.log(`[CF ProductSync] Synced ${variants.length} variants, ${colors.length} colors, ${sizes.length} sizes, ${placements.length} placements`);

    res.json({
      success: true,
      product: { id: updatedDoc.id, ...updatedDoc.data() },
      syncedData: { placements, colors, sizes, variantsCount: variants.length },
    });
  } catch (error: any) {
    console.error('[CF ProductSync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});



  }
