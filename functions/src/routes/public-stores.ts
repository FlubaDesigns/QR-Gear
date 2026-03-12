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
    const { name, roleType } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Store name is required' }); return; }
    if (!roleType || !['internal', 'external', 'member', 'marketplace'].includes(roleType)) { res.status(400).json({ error: 'Valid roleType is required' }); return; }
    const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const storeData: Record<string, any> = { name: name.trim(), roleType, isActive: true, channelCount: 0, createdAt: new Date().toISOString() };
    if (roleType === 'marketplace') {
      const { platform, apiKeyRef, shopId, shopName, feePercent, syncEnabled } = req.body;
      storeData.marketplaceConfig = {
        platform: platform || '',
        apiKeyRef: apiKeyRef || '',
        shopId: shopId || '',
        shopName: shopName || '',
        feePercent: typeof feePercent === 'number' ? feePercent : 0,
        syncEnabled: syncEnabled === true,
        apiKeyConfigured: false,
      };
    }
    await db.collection('stores').doc(storeId).set(storeData);
    res.json({ id: storeId, ...storeData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/stores/:storeId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const channelsSnapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
    const batch = db.batch();
    channelsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('stores').doc(storeId));
    await batch.commit();
    res.json({ success: true, deletedChannels: channelsSnapshot.size });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
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
    const { storeId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Channel name is required' }); return; }
    const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const channelData = { name: name.trim(), storeId, isActive: true, productCount: 0, createdAt: new Date().toISOString() };
    await db.collection('storeChannels').doc(channelId).set(channelData);
    res.json({ id: channelId, ...channelData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/stores/:storeId/channels/:channelId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params;
    await db.collection('storeChannels').doc(channelId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/allowed-products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const doc = await db.collection('storeAllowedProducts').doc(storeId).get();
    if (!doc.exists) { res.json({ storeId, products: [] }); return; }
    const data = doc.data();
    res.json({ storeId, products: data?.products || [], updatedAt: data?.updatedAt });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/allowed-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { products } = req.body;
    if (!Array.isArray(products)) { res.status(400).json({ error: 'products must be an array' }); return; }
    const pricingDoc = await db.collection("testSettings").doc("pricing").get();
    const ps = pricingDoc.exists ? pricingDoc.data() : null;
    const markupPercent = ps?.markupPercent ?? 25; const markupFixed = ps?.markupFixed ?? 0;
    const memberProfitShare = ps?.memberProfitShare ?? 0.25;
    const enrichedProducts = await Promise.all(products.map(async (p: any) => {
      try {
        let baseCost = 0;
        if (p.blueprintId) {
          const provSnap = await db.collection('printifyPrintProviders').where('blueprintId', '==', p.blueprintId).limit(5).get();
          const usaProv = provSnap.docs.filter(d => d.data().isUSA);
          const selectedProv = usaProv[0] || provSnap.docs[0];
          if (selectedProv) baseCost = (selectedProv.data().minCost || 0) / 100;
        }
        const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
        const profit = retailPrice - baseCost;
        const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
        return { blueprintId: p.blueprintId, title: p.title, addedAt: p.addedAt || new Date().toISOString(), imageUrl: p.imageUrl || null, baseCost, retailPrice, profit, memberEarnings, pricingUsed: { markupPercent, markupFixed, memberProfitShare }, packetCreatedAt: new Date().toISOString() };
      } catch { return { ...p, addedAt: p.addedAt || new Date().toISOString(), baseCost: 0, retailPrice: 0, profit: 0, memberEarnings: 0 }; }
    }));
    await db.collection('storeAllowedProducts').doc(storeId).set({ storeId, products: enrichedProducts, updatedAt: new Date().toISOString() });
    res.json({ success: true, storeId, productCount: enrichedProducts.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
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
  