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
  // ============ MARKETPLACE ENDPOINTS ============

app.get('/admin/marketplace/stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('stores').where('roleType', '==', 'marketplace').get();
    const stores = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      const config = data.marketplaceConfig || {};
      config.apiKeyConfigured = !!(config.apiKeyRef);
      return { id: doc.id, ...data, marketplaceConfig: config };
    });
    stores.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    res.json(stores);
  } catch (error: any) {
    console.error('[Marketplace] GET stores error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/marketplace/stores/:storeId/config', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) { res.status(404).json({ error: 'Store not found' }); return; }
    const storeData = storeDoc.data();
    if (storeData?.roleType !== 'marketplace') { res.status(400).json({ error: 'Store is not a marketplace store' }); return; }
    const { platform, apiKeyRef, shopId, shopName, feePercent, syncEnabled } = req.body;
    const updatedConfig: Record<string, any> = { ...(storeData?.marketplaceConfig || {}) };
    if (platform !== undefined) updatedConfig.platform = platform;
    if (apiKeyRef !== undefined) updatedConfig.apiKeyRef = apiKeyRef;
    if (shopId !== undefined) updatedConfig.shopId = shopId;
    if (shopName !== undefined) updatedConfig.shopName = shopName;
    if (feePercent !== undefined) updatedConfig.feePercent = typeof feePercent === 'number' ? feePercent : parseFloat(feePercent) || 0;
    if (syncEnabled !== undefined) updatedConfig.syncEnabled = syncEnabled === true;
    updatedConfig.updatedAt = new Date().toISOString();
    await db.collection('stores').doc(storeId).update({ marketplaceConfig: updatedConfig });
    res.json({ id: storeId, marketplaceConfig: updatedConfig });
  } catch (error: any) {
    console.error('[Marketplace] PUT config error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/marketplace/stores/:storeId/listings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) { res.status(404).json({ error: 'Store not found' }); return; }
    const storeData = storeDoc.data();
    if (storeData?.roleType !== 'marketplace') { res.status(400).json({ error: 'Store is not a marketplace store' }); return; }
    const { productId, title, price, sku } = req.body;
    if (!productId) { res.status(400).json({ error: 'productId is required' }); return; }
    const platform = storeData?.marketplaceConfig?.platform || 'unknown';
    const listingData = {
      storeId,
      productId,
      platform,
      title: title || '',
      price: typeof price === 'number' ? price : parseFloat(price) || 0,
      sku: sku || '',
      status: 'pending',
      marketplaceListingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const docRef = await db.collection('marketplaceListings').add(listingData);
    res.json({ id: docRef.id, ...listingData });
  } catch (error: any) {
    console.error('[Marketplace] POST listing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/marketplace/stores/:storeId/listings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) { res.status(404).json({ error: 'Store not found' }); return; }
    const snapshot = await db.collection('marketplaceListings').where('storeId', '==', storeId).get();
    const listings = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    listings.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(listings);
  } catch (error: any) {
    console.error('[Marketplace] GET listings error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/marketplace/stores/:storeId/listings/:listingId/push', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, listingId } = req.params;
    const listingDoc = await db.collection('marketplaceListings').doc(listingId).get();
    if (!listingDoc.exists) { res.status(404).json({ error: 'Listing not found' }); return; }
    const listing = listingDoc.data();
    if (listing?.storeId !== storeId) { res.status(400).json({ error: 'Listing does not belong to this store' }); return; }
    const storeDoc = await db.collection('stores').doc(storeId).get();
    const storeData = storeDoc.data();
    const platform = storeData?.marketplaceConfig?.platform || 'unknown';
    const apiKeyRef = storeData?.marketplaceConfig?.apiKeyRef;
    if (!apiKeyRef) {
      await db.collection('marketplaceListings').doc(listingId).update({ status: 'error', errorMessage: 'No API key configured for this marketplace', updatedAt: new Date().toISOString() });
      res.status(400).json({ error: 'No API key configured. Set up API credentials in marketplace config first.', message: 'API key not configured' });
      return;
    }
    await db.collection('marketplaceListings').doc(listingId).update({ status: 'syncing', updatedAt: new Date().toISOString() });
    res.json({ message: `Listing queued for push to ${platform}. API integration will process it.`, status: 'syncing' });
  } catch (error: any) {
    console.error('[Marketplace] POST push listing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/stores/:storeId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) { res.status(404).json({ error: 'Store not found' }); return; }
    const updates: Record<string, any> = {};
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection('stores').doc(storeId).update(updates);
    res.json({ id: storeId, ...storeDoc.data(), ...updates });
  } catch (error: any) {
    console.error('[Stores] PATCH error:', error);
    res.status(500).json({ error: error.message });
  }
});


  }
  