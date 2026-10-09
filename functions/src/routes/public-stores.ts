import { createStore, createStoreChannel, deleteStore, deleteStoreChannel } from '../services/store-channels';
import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
import { printfulClient } from '../services/printful';
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
  // ============ PUBLIC STORE ROUTES (Batch 3) ============

app.get('/stores/by-id/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    let doc = await db.collection('stores').doc(storeId).get();
    if (doc.exists) { const data = doc.data(); res.json({ id: doc.id, name: data?.name || storeId, type: data?.roleType || 'internal', roleType: data?.roleType || 'internal', isActive: data?.isActive ?? true }); return; }
    doc = await db.collection('partnerStores').doc(storeId).get();
    if (doc.exists) { const data = doc.data(); res.json({ id: doc.id, name: data?.name || storeId, type: data?.isInternal ? 'internal' : 'external', roleType: data?.isInternal ? 'internal' : 'external', isActive: data?.isActive ?? true, isPartnerStore: true }); return; }
    res.status(404).json({ error: 'Store not found' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await createStore(db, req.body));
  } catch (error: any) {
    console.error('[Stores] POST /stores:', error.message);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.delete('/stores/:storeId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await deleteStore(db, () => admin.firestore.FieldValue.serverTimestamp(), req.params.storeId));
  } catch (error: any) {
    console.error('[Stores] DELETE /stores/:storeId:', error.message);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/stores/:storeId/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const snapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
    const channels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    channels.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(channels);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await createStoreChannel(db, req.params.storeId, req.body));
  } catch (error: any) {
    console.error('[Stores] POST /stores/:storeId/channels:', error.message);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.delete('/stores/:storeId/channels/:channelId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await deleteStoreChannel(db, () => admin.firestore.FieldValue.serverTimestamp(), req.params.storeId, req.params.channelId));
  } catch (error: any) {
    console.error('[Stores] DELETE /stores/:storeId/channels/:channelId:', error.message);
    res.status(error.status || 500).json({ error: error.message });
  }
});



app.get('/partner-stores', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores').get();
    const stores = snapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, name: data.name, slug: data.slug, isInternal: data.isInternal ?? true, isActive: data.isActive ?? true, availableSegments: data.availableSegments || [], apiKey: data.apiKey || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null }; });
    res.json(stores);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/channels/:channelId/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const { productIds } = req.body;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    const existingSnapshot = await db.collection('storeChannelProducts').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
    existingSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    for (const productId of (productIds || [])) { const docRef = db.collection('storeChannelProducts').doc(); batch.set(docRef, { storeId, channelId, productId, createdAt: now }); }
    await batch.commit();
    res.json({ success: true, synced: (productIds || []).length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels/:channelId/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const snapshot = await db.collection('storeChannelProducts').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels/:channelId/content', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const snapshot = await db.collection('storeChannelContent').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
    const content = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(content);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/channels/:channelId/content', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const contentData = req.body;
    const docRef = db.collection('storeChannelContent').doc();
    await docRef.set({ ...contentData, storeId, channelId, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, ...contentData, storeId, channelId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/stores/:storeId/channels/:channelId/content/:contentId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params;
    await db.collection('storeChannelContent').doc(contentId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels/:channelId/collections', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const snapshot = await db.collection('storeChannelCollections').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
    const collections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(collections);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const collectionData = req.body;
    const docRef = db.collection('storeChannelCollections').doc();
    await docRef.set({ ...collectionData, storeId, channelId, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, ...collectionData, storeId, channelId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels/:channelId/collections/:collectionName/items', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId, collectionName } = req.params;
    const snapshot = await db.collection('storeChannelCollections').where('storeId', '==', storeId).where('channelId', '==', channelId).where('name', '==', collectionName).get();
    if (snapshot.empty) { res.json({ items: [] }); return; }
    const data = snapshot.docs[0].data();
    res.json({ items: data?.items || [] });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


  }
  