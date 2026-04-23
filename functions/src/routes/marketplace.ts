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
import { executeSyncJob, retryFailedJob, processRetryQueue, startRetrySweep } from '../services/marketplace-sync';
import { normalizeProductForPublishing, createSurfaceDraftFromNormalizedProduct } from '../services/surface-generator';
import type { SupportedMarketplace, GenerateDefaults } from '../services/surface-generator';
import { pushListingToAmazon } from '../services/amazon-sp-api';
import type { AmazonListingProduct } from '../services/amazon-sp-api';
import { pushListingToEbay } from '../services/ebay-api';
import type { EbayListingProduct } from '../services/ebay-api';
import { pushListingToEtsy, refreshAccessToken as refreshEtsyToken } from '../services/etsy-api';
import type { EtsyListingProduct } from '../services/etsy-api';
import {
  SURFACES_COLLECTION,
  SURFACE_VARIANTS_COLLECTION,
  MARKETPLACE_ACCOUNTS_COLLECTION,
  MARKETPLACE_LISTINGS_COLLECTION,
  MARKETPLACE_SYNC_JOBS_COLLECTION,
  MARKETPLACE_SYNC_LOGS_COLLECTION,
  MARKETPLACE_PLATFORMS,
} from '../constants';

const VALID_PLATFORMS = new Set<string>(MARKETPLACE_PLATFORMS);
const VALID_SURFACE_STATUSES = new Set<string>(['draft', 'ready', 'published', 'archived']);
const VALID_LISTING_STATUSES = new Set<string>(['pending', 'draft', 'active', 'syncing', 'error', 'paused', 'delisted']);
const VALID_JOB_STATUSES = new Set<string>(['queued', 'running', 'completed', 'failed', 'cancelled']);
const VALID_JOB_ACTIONS = new Set<string>(['create', 'update', 'delete', 'sync_inventory', 'full_sync']);
const VALID_LOG_LEVELS = new Set<string>(['info', 'warn', 'error']);

  export function register(app: express.Express): void {

  startRetrySweep();

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


// ============ CANONICAL SURFACES SYSTEM ============

// --- Marketplace Accounts ---

app.get('/admin/surfaces/accounts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).get();
    const accounts = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    accounts.sort((a: any, b: any) => (a.accountName || '').localeCompare(b.accountName || ''));
    res.json(accounts);
  } catch (error: any) {
    console.error('[Surfaces] GET accounts error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/accounts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform, accountName, shopId, shopName, feePercent } = req.body;
    if (!platform || !accountName) {
      res.status(400).json({ error: 'platform and accountName are required' }); return;
    }
    if (!VALID_PLATFORMS.has(platform)) {
      res.status(400).json({ error: `Invalid platform. Must be one of: ${MARKETPLACE_PLATFORMS.join(', ')}` }); return;
    }
    const now = new Date().toISOString();
    const data = {
      platform,
      accountName: accountName.trim(),
      shopId: shopId || '',
      shopName: shopName || '',
      isActive: true,
      feePercent: typeof feePercent === 'number' ? feePercent : parseFloat(feePercent) || 0,
      apiKeyConfigured: false,
      healthStatus: 'unknown',
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[Surfaces] POST account error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/surfaces/accounts/:accountId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const doc = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Account not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = ['accountName', 'shopId', 'shopName', 'isActive', 'feePercent', 'platform'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.feePercent !== undefined) {
      updates.feePercent = typeof updates.feePercent === 'number' ? updates.feePercent : parseFloat(updates.feePercent) || 0;
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update(updates);
    res.json({ id: accountId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[Surfaces] PATCH account error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/surfaces/accounts/:accountId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const doc = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Account not found' }); return; }
    const listingsSnap = await db.collection(MARKETPLACE_LISTINGS_COLLECTION).where('accountId', '==', accountId).limit(1).get();
    if (!listingsSnap.empty) {
      res.status(400).json({ error: 'Cannot delete account with active listings. Remove listings first.' }); return;
    }
    await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Surfaces] DELETE account error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Surfaces ---

app.get('/admin/surfaces', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(SURFACES_COLLECTION).get();
    const surfaces = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    surfaces.sort((a: any, b: any) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    res.json(surfaces);
  } catch (error: any) {
    console.error('[Surfaces] GET surfaces error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/surfaces/:surfaceId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const doc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Surface not found' }); return; }
    const variantsSnap = await db.collection(SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
    const variants = variantsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ ...doc.data(), id: doc.id, variants });
  } catch (error: any) {
    console.error('[Surfaces] GET surface error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      masterProductId, title, subtitle, description, bulletPoints, tags, keywords,
      images, mockupImages, retailPrice, compareAtPrice, currency, sku, defaultSkuPrefix,
      enabledPlatforms, storeId, channelId, collectionId, productId, artifactId, mosaicId,
      supportsEmbedStore, supportsEmbedProduct, supportsEmbedBuilder,
      supportsEtsy, supportsEbay, supportsAmazon,
      // Marketplace-common fields
      condition, brand, material, department, shippingProfileRef, returnsProfileRef,
      // eBay-specific block
      ebay,
    } = req.body;
    if (!masterProductId) { res.status(400).json({ error: 'masterProductId is required' }); return; }
    const now = new Date().toISOString();
    const data: Record<string, any> = {
      masterProductId,
      title: title || '',
      subtitle: subtitle || '',
      description: description || '',
      bulletPoints: Array.isArray(bulletPoints) ? bulletPoints : [],
      tags: Array.isArray(tags) ? tags : [],
      keywords: Array.isArray(keywords) ? keywords : [],
      images: Array.isArray(images) ? images : [],
      mockupImages: Array.isArray(mockupImages) ? mockupImages : [],
      retailPrice: typeof retailPrice === 'number' ? retailPrice : parseFloat(retailPrice) || 0,
      compareAtPrice: compareAtPrice != null ? (typeof compareAtPrice === 'number' ? compareAtPrice : parseFloat(compareAtPrice) || undefined) : undefined,
      currency: currency || 'USD',
      sku: sku || '',
      defaultSkuPrefix: defaultSkuPrefix || '',
      enabledPlatforms: Array.isArray(enabledPlatforms) ? enabledPlatforms : [],
      storeId: storeId || '',
      channelId: channelId || '',
      collectionId: collectionId || '',
      productId: productId || '',
      artifactId: artifactId || '',
      mosaicId: mosaicId || '',
      supportsEmbedStore: supportsEmbedStore === true,
      supportsEmbedProduct: supportsEmbedProduct === true,
      supportsEmbedBuilder: supportsEmbedBuilder === true,
      supportsEtsy: supportsEtsy === true,
      supportsEbay: supportsEbay === true,
      supportsAmazon: supportsAmazon === true,
      // Marketplace-common
      condition: condition || null,
      brand: brand || null,
      material: material || null,
      department: department || null,
      shippingProfileRef: shippingProfileRef || null,
      returnsProfileRef: returnsProfileRef || null,
      // eBay block — stored as a scoped sub-object; null when not provided
      ebay: ebay && typeof ebay === 'object' ? ebay : null,
      status: 'draft',
      readinessErrors: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(SURFACES_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[Surfaces] POST surface error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/surfaces/:surfaceId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const doc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Surface not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = [
      'title', 'subtitle', 'description', 'bulletPoints', 'tags', 'keywords',
      'images', 'mockupImages', 'retailPrice', 'compareAtPrice', 'currency',
      'sku', 'defaultSkuPrefix', 'enabledPlatforms', 'status',
      'storeId', 'channelId', 'collectionId', 'productId', 'artifactId', 'mosaicId',
      'supportsEmbedStore', 'supportsEmbedProduct', 'supportsEmbedBuilder',
      'supportsEtsy', 'supportsEbay', 'supportsAmazon', 'isActive',
      // Marketplace-common
      'condition', 'brand', 'material', 'department', 'shippingProfileRef', 'returnsProfileRef',
      // eBay block
      'ebay',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.retailPrice !== undefined) {
      updates.retailPrice = typeof updates.retailPrice === 'number' ? updates.retailPrice : parseFloat(updates.retailPrice) || 0;
    }
    if (updates.status !== undefined && !VALID_SURFACE_STATUSES.has(updates.status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_SURFACE_STATUSES].join(', ')}` }); return;
    }
    if (updates.enabledPlatforms !== undefined) {
      if (!Array.isArray(updates.enabledPlatforms) || updates.enabledPlatforms.some((p: string) => !VALID_PLATFORMS.has(p))) {
        res.status(400).json({ error: `Invalid enabledPlatforms. Each must be one of: ${MARKETPLACE_PLATFORMS.join(', ')}` }); return;
      }
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(SURFACES_COLLECTION).doc(surfaceId).update(updates);
    res.json({ id: surfaceId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[Surfaces] PATCH surface error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/surfaces/:surfaceId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const doc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Surface not found' }); return; }
    const listingsSnap = await db.collection(MARKETPLACE_LISTINGS_COLLECTION).where('surfaceId', '==', surfaceId).limit(1).get();
    if (!listingsSnap.empty) {
      res.status(400).json({ error: 'Cannot delete surface with active listings. Remove listings first.' }); return;
    }
    const variantsSnap = await db.collection(SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
    const batch = db.batch();
    variantsSnap.docs.forEach((d: any) => batch.delete(d.ref));
    batch.delete(db.collection(SURFACES_COLLECTION).doc(surfaceId));
    await batch.commit();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Surfaces] DELETE surface error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/:surfaceId/check-readiness', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const doc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Surface not found' }); return; }
    const surface = doc.data() as any;
    const variantsSnap = await db.collection(SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
    const variants = variantsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const errors: string[] = [];
    if (!surface.title || surface.title.trim().length === 0) errors.push('Title is required');
    if (!surface.description || surface.description.trim().length === 0) errors.push('Description is required');
    if (!surface.images || surface.images.length === 0) errors.push('At least one image is required');
    if (surface.retailPrice == null || surface.retailPrice <= 0) errors.push('Retail price must be greater than zero');
    if (!surface.sku || surface.sku.trim().length === 0) errors.push('SKU is required');
    const enabledVariants = variants.filter((v: any) => v.enabled);
    if (enabledVariants.length === 0) errors.push('At least one enabled variant is required');
    const variantSkus: string[] = [];
    for (const v of enabledVariants) {
      if (!v.sku || v.sku.trim().length === 0) {
        errors.push(`Variant ${v.size}/${v.color} is missing a SKU`);
      } else {
        variantSkus.push(v.sku);
      }
    }
    const uniqueSkus = new Set(variantSkus);
    if (variantSkus.length !== uniqueSkus.size) errors.push('All variant SKUs must be unique');
    const hasAnyChannel = (surface.enabledPlatforms && surface.enabledPlatforms.length > 0)
      || surface.supportsEmbedStore || surface.supportsEmbedProduct || surface.supportsEmbedBuilder
      || surface.supportsEtsy || surface.supportsEbay || surface.supportsAmazon;
    if (!hasAnyChannel) errors.push('At least one selling channel must be enabled (marketplace or embed)');

    // eBay-specific readiness validation
    if (surface.supportsEbay) {
      const eb = surface.ebay || {};
      if (!eb.categoryId || !String(eb.categoryId).trim()) {
        errors.push('eBay: Category ID is required (ebay.categoryId)');
      }
      if (!eb.conditionId || !String(eb.conditionId).trim()) {
        errors.push('eBay: Condition ID is required (ebay.conditionId)');
      }
      if (!eb.listingFormat) {
        errors.push('eBay: Listing format must be set (FIXED_PRICE or AUCTION)');
      }
      // At least one aspect/identifier must be known — brand from common or itemSpecifics
      const hasBrand = (surface.brand && surface.brand.trim()) || (eb.brand && eb.brand.trim());
      const hasItemSpecifics = eb.itemSpecifics && Object.keys(eb.itemSpecifics).length > 0;
      if (!hasBrand && !hasItemSpecifics) {
        errors.push('eBay: At least a Brand or one item specific is required for eBay aspects');
      }
      // Warn (non-blocking) about shipping policy — surface can still be "ready" without it
      if (!eb.shippingPolicyId && !eb.returnsPolicyId) {
        // Not a blocking error — just surfaces in logs via readiness response
        // so callers can surface this as a warning in the UI
      }
    }

    const newStatus = errors.length === 0 ? 'ready' : 'draft';
    await db.collection(SURFACES_COLLECTION).doc(surfaceId).update({ readinessErrors: errors, status: newStatus, updatedAt: new Date().toISOString() });
    res.json({ ready: errors.length === 0, errors, status: newStatus });
  } catch (error: any) {
    console.error('[Surfaces] POST check-readiness error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Generate Surface from Built Product ---

app.post('/admin/surfaces/generate-from-instance', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId, marketplace = 'ebay', defaults = {} } = req.body;

    if (!instanceId || typeof instanceId !== 'string' || !instanceId.trim()) {
      res.status(400).json({ error: 'instanceId is required' });
      return;
    }

    const validMarketplaces = new Set<string>(['ebay', 'etsy', 'amazon']);
    if (!validMarketplaces.has(marketplace)) {
      res.status(400).json({ error: `Invalid marketplace. Must be one of: ebay, etsy, amazon` });
      return;
    }

    console.log(`[SurfaceGenerator] Normalizing instance ${instanceId} for ${marketplace}`);

    const normalized = await normalizeProductForPublishing(instanceId.trim(), db);
    const surfacePayload = createSurfaceDraftFromNormalizedProduct(
      normalized,
      marketplace as SupportedMarketplace,
      defaults as GenerateDefaults,
    );

    const docRef = await db.collection(SURFACES_COLLECTION).add(surfacePayload);

    console.log(`[SurfaceGenerator] Created surface ${docRef.id} from instance ${instanceId}`);
    res.json({ success: true, surfaceId: docRef.id, instanceId, marketplace });
  } catch (error: any) {
    console.error('[SurfaceGenerator] generate-from-instance error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- Push Surface to Amazon ---

app.post('/admin/surfaces/:surfaceId/push-to-amazon', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const { accountId, sku: skuOverride } = req.body;

    if (!accountId) {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }

    // Load surface
    const surfaceDoc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!surfaceDoc.exists) {
      res.status(404).json({ error: 'Surface not found' });
      return;
    }
    const surface = surfaceDoc.data() as any;

    // Load account and verify it is an Amazon account with credentials
    const accountDoc = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
    if (!accountDoc.exists) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const account = accountDoc.data() as any;

    if (account.platform !== 'amazon') {
      res.status(400).json({ error: 'Account is not an Amazon account' });
      return;
    }
    if (!account.amazonConnected || !account.amazonRefreshToken) {
      res.status(400).json({
        error: 'Amazon account not connected. Complete the OAuth flow first.',
        setupRequired: true,
      });
      return;
    }
    if (!account.amazonSellerId) {
      res.status(400).json({ error: 'Amazon Seller ID not recorded on this account. Reconnect via OAuth.' });
      return;
    }

    const credentials = {
      sellerId: account.amazonSellerId,
      marketplaceId: account.amazonMarketplaceId || 'ATVPDKIKX0DER',
      refreshToken: account.amazonRefreshToken,
    };

    // Derive SKU: prefer explicit override → surface.sku → surface.id slice
    const sku = skuOverride || surface.sku || `QRG-${surfaceId.slice(0, 8).toUpperCase()}`;

    // Map surface data to AmazonListingProduct
    const product: AmazonListingProduct = {
      title: surface.title || 'QR Gear Product',
      description: surface.description || '',
      bulletPoints: surface.bulletPoints || [],
      keywords: surface.tags || [],
      price: surface.price || surface.basePrice || 0,
      currencyCode: 'USD',
      quantity: 100,
      condition: 'new_new',
      brandName: surface.brand || 'QR Gear',
      imageUrls: (surface.images || []).map((img: any) => (typeof img === 'string' ? img : img?.url)).filter(Boolean),
      productType: surface.amazonProductType || 'SHIRT',
    };

    if (product.price <= 0) {
      res.status(400).json({ error: 'Surface has no price set. Set a price before pushing to Amazon.' });
      return;
    }

    console.log(`[Amazon Push] Pushing surface ${surfaceId} as SKU ${sku} to account ${accountId}`);
    const result = await pushListingToAmazon(credentials, product, sku);

    // Record the push attempt on the surface
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      [`amazonPushHistory.${now.replace(/[:.]/g, '_')}`]: {
        accountId,
        sku,
        success: result.success,
        status: result.status,
        error: result.error || null,
        submissionId: result.submissionId || null,
        pushedAt: now,
      },
      lastAmazonPushAt: now,
      lastAmazonPushSuccess: result.success,
      lastAmazonPushSku: sku,
    };
    await db.collection(SURFACES_COLLECTION).doc(surfaceId).update(updateData);

    res.json({ ...result, surfaceId, accountId });
  } catch (error: any) {
    console.error('[Amazon Push] push-to-amazon error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Push Surface to eBay ---

app.post('/admin/surfaces/:surfaceId/push-to-ebay', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const { accountId, sku: skuOverride } = req.body;

    if (!accountId) {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }

    // Load surface
    const surfaceDoc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!surfaceDoc.exists) {
      res.status(404).json({ error: 'Surface not found' });
      return;
    }
    const surface = surfaceDoc.data() as any;

    // Load account and verify it is an eBay account with credentials
    const accountDoc = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
    if (!accountDoc.exists) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const account = accountDoc.data() as any;

    if (account.platform !== 'ebay') {
      res.status(400).json({ error: 'Account is not an eBay account' });
      return;
    }
    if (!account.ebayConnected || !account.ebayRefreshToken) {
      res.status(400).json({
        error: 'eBay account not connected. Complete the OAuth flow first.',
        setupRequired: true,
      });
      return;
    }

    const credentials = {
      userId: account.ebayUserId || '',
      username: account.ebayUsername || '',
      refreshToken: account.ebayRefreshToken,
    };

    // Derive SKU
    const sku = skuOverride || surface.sku || `QRG-${surfaceId.slice(0, 8).toUpperCase()}`;

    // eBay block fields from surface
    const eb = surface.ebay || {};

    if (!eb.categoryId) {
      res.status(400).json({ error: 'Surface is missing eBay category ID (ebay.categoryId). Edit the surface and set it before pushing.' });
      return;
    }

    if (surface.retailPrice == null || surface.retailPrice <= 0) {
      res.status(400).json({ error: 'Surface has no price set. Set a price before pushing to eBay.' });
      return;
    }

    // Parse itemSpecifics — stored as Record<string,string> or JSON string
    let aspects: Record<string, string[]> = {};
    if (eb.itemSpecifics) {
      const raw = typeof eb.itemSpecifics === 'string'
        ? JSON.parse(eb.itemSpecifics)
        : eb.itemSpecifics;
      for (const [k, v] of Object.entries(raw)) {
        aspects[k] = Array.isArray(v) ? v : [String(v)];
      }
    }

    // Map surface data to EbayListingProduct
    const product: EbayListingProduct = {
      title: surface.title || 'QR Gear Product',
      description: surface.description || '',
      price: eb.priceOverride || surface.retailPrice || surface.price || surface.basePrice || 0,
      currencyCode: surface.currency || 'USD',
      quantity: eb.quantity || 100,
      condition: eb.conditionId || 'NEW',
      brand: eb.brand || surface.brand || 'QR Gear',
      imageUrls: (surface.images || []).map((img: any) => (typeof img === 'string' ? img : img?.url)).filter(Boolean),
      categoryId: String(eb.categoryId),
      listingFormat: eb.listingFormat || 'FIXED_PRICE',
      fulfillmentPolicyId: eb.shippingPolicyId || undefined,
      paymentPolicyId: eb.paymentPolicyId || undefined,
      returnPolicyId: eb.returnsPolicyId || undefined,
      merchantLocationKey: eb.merchantLocationKey || undefined,
      upc: eb.upc || undefined,
      ean: eb.ean || undefined,
      mpn: eb.mpn || undefined,
      aspects: Object.keys(aspects).length > 0 ? aspects : undefined,
      bestOfferEnabled: eb.bestOfferEnabled || false,
      subtitle: eb.subtitle || undefined,
    };

    console.log(`[eBay Push] Pushing surface ${surfaceId} as SKU ${sku} to account ${accountId}`);
    const result = await pushListingToEbay(credentials, product, sku);

    // Record the push attempt on the surface
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      [`ebayPushHistory.${now.replace(/[:.]/g, '_')}`]: {
        accountId,
        sku,
        success: result.success,
        status: result.status,
        listingId: result.listingId || null,
        offerId: result.offerId || null,
        error: result.error || null,
        pushedAt: now,
      },
      lastEbayPushAt: now,
      lastEbayPushSuccess: result.success,
      lastEbayPushSku: sku,
    };
    await db.collection(SURFACES_COLLECTION).doc(surfaceId).update(updateData);

    res.json({ ...result, surfaceId, accountId });
  } catch (error: any) {
    console.error('[eBay Push] push-to-ebay error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Push Surface to Etsy ---

app.post('/admin/surfaces/:surfaceId/push-to-etsy', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const {
      accountId,
      sku: skuOverride,
      taxonomyId,
      shippingProfileId,
      returnPolicyId,
      whoMade = 'i_did',
      whenMade = 'made_to_order',
    } = req.body;

    if (!accountId) {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }
    if (!taxonomyId) {
      res.status(400).json({ error: 'taxonomyId is required (Etsy category ID). Find yours at https://www.etsy.com/developers/documentation/getting_started/taxonomy' });
      return;
    }
    if (!shippingProfileId) {
      res.status(400).json({ error: 'shippingProfileId is required. Create a shipping profile in your Etsy shop and paste its ID here.' });
      return;
    }

    // Load surface
    const surfaceDoc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!surfaceDoc.exists) {
      res.status(404).json({ error: 'Surface not found' });
      return;
    }
    const surface = surfaceDoc.data() as any;

    // Load account and verify
    const accountDoc = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
    if (!accountDoc.exists) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const account = accountDoc.data() as any;

    if (account.platform !== 'etsy') {
      res.status(400).json({ error: 'Account is not an Etsy account' });
      return;
    }
    if (!account.etsyConnected || !account.etsyRefreshToken) {
      res.status(400).json({
        error: 'Etsy account not connected. Complete the OAuth flow first.',
        setupRequired: true,
      });
      return;
    }
    if (!account.etsyShopId) {
      res.status(400).json({ error: 'Etsy Shop ID not found on this account. Reconnect via OAuth to re-fetch your shop.' });
      return;
    }

    if (surface.retailPrice == null || surface.retailPrice <= 0) {
      res.status(400).json({ error: 'Surface has no price set. Set a price before pushing to Etsy.' });
      return;
    }

    const sku = skuOverride || surface.sku || `QRG-${surfaceId.slice(0, 8).toUpperCase()}`;

    const credentials = {
      accessToken: '',  // will be refreshed inside pushListingToEtsy
      refreshToken: account.etsyRefreshToken,
      shopId: account.etsyShopId,
      shopName: account.etsyShopName || '',
      userId: account.etsyUserId || '',
    };

    const product: EtsyListingProduct = {
      title: (surface.title || 'QR Gear Product').slice(0, 140),
      description: surface.description || '',
      price: surface.retailPrice || surface.price || surface.basePrice || 0,
      currencyCode: surface.currency || 'USD',
      quantity: 100,
      tags: (surface.tags || []).slice(0, 13),
      imageUrls: (surface.images || []).map((img: any) => (typeof img === 'string' ? img : img?.url)).filter(Boolean),
      taxonomyId: parseInt(String(taxonomyId), 10),
      shippingProfileId: parseInt(String(shippingProfileId), 10),
      returnPolicyId: returnPolicyId ? parseInt(String(returnPolicyId), 10) : undefined,
      whoMade: whoMade || 'i_did',
      whenMade: whenMade || 'made_to_order',
      materials: surface.brand ? [surface.brand] : undefined,
      sku,
    };

    console.log(`[Etsy Push] Pushing surface ${surfaceId} as SKU ${sku} to account ${accountId} (shop ${account.etsyShopId})`);
    const result = await pushListingToEtsy(credentials, product);

    // Record the push attempt on the surface
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      [`etsyPushHistory.${now.replace(/[:.]/g, '_')}`]: {
        accountId,
        sku,
        success: result.success,
        state: result.state || null,
        listingId: result.listingId || null,
        url: result.url || null,
        error: result.error || null,
        pushedAt: now,
      },
      lastEtsyPushAt: now,
      lastEtsyPushSuccess: result.success,
      lastEtsyPushSku: sku,
    };
    await db.collection(SURFACES_COLLECTION).doc(surfaceId).update(updateData);

    res.json({ ...result, surfaceId, accountId });
  } catch (error: any) {
    console.error('[Etsy Push] push-to-etsy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Surface Variants ---

app.get('/admin/surfaces/:surfaceId/variants', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const snapshot = await db.collection(SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
    const variants = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    res.json(variants);
  } catch (error: any) {
    console.error('[Surfaces] GET variants error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/:surfaceId/variants', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const surfaceDoc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!surfaceDoc.exists) { res.status(404).json({ error: 'Surface not found' }); return; }
    const { size, color, colorHex, sku, priceOverride, enabled, inventoryQuantity, productVariantId, titleSuffix, option1Name, option1Value, option2Name, option2Value, option3Name, option3Value, availability, marketplaceOverrides } = req.body;
    if (!size || !color) { res.status(400).json({ error: 'size and color are required' }); return; }
    const now = new Date().toISOString();
    const data: Record<string, any> = {
      surfaceId,
      size,
      color,
      colorHex: colorHex || undefined,
      sku: sku || '',
      priceOverride: priceOverride != null ? (typeof priceOverride === 'number' ? priceOverride : parseFloat(priceOverride) || undefined) : undefined,
      enabled: enabled !== false,
      inventoryQuantity: typeof inventoryQuantity === 'number' ? inventoryQuantity : 999,
      productVariantId: productVariantId || '',
      titleSuffix: titleSuffix || '',
      option1Name: option1Name || '',
      option1Value: option1Value || '',
      option2Name: option2Name || '',
      option2Value: option2Value || '',
      option3Name: option3Name || '',
      option3Value: option3Value || '',
      availability: availability || 'in_stock',
      marketplaceOverrides: marketplaceOverrides || {},
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(SURFACE_VARIANTS_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[Surfaces] POST variant error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/surfaces/variants/:variantId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { variantId } = req.params;
    const doc = await db.collection(SURFACE_VARIANTS_COLLECTION).doc(variantId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Variant not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = ['size', 'color', 'colorHex', 'sku', 'priceOverride', 'enabled', 'inventoryQuantity', 'productVariantId', 'titleSuffix', 'option1Name', 'option1Value', 'option2Name', 'option2Value', 'option3Name', 'option3Value', 'availability', 'marketplaceOverrides'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(SURFACE_VARIANTS_COLLECTION).doc(variantId).update(updates);
    res.json({ id: variantId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[Surfaces] PATCH variant error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/surfaces/variants/:variantId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { variantId } = req.params;
    const doc = await db.collection(SURFACE_VARIANTS_COLLECTION).doc(variantId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Variant not found' }); return; }
    await db.collection(SURFACE_VARIANTS_COLLECTION).doc(variantId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Surfaces] DELETE variant error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Marketplace Listings (canonical) ---

app.get('/admin/surfaces/listings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId, accountId, status } = req.query;
    let query: any = db.collection(MARKETPLACE_LISTINGS_COLLECTION);
    if (surfaceId) query = query.where('surfaceId', '==', surfaceId);
    if (accountId) query = query.where('accountId', '==', accountId);
    if (status) query = query.where('status', '==', status);
    const snapshot = await query.get();
    const listings = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    listings.sort((a: any, b: any) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    res.json(listings);
  } catch (error: any) {
    console.error('[Surfaces] GET listings error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/listings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId, accountId } = req.body;
    if (!surfaceId || !accountId) { res.status(400).json({ error: 'surfaceId and accountId are required' }); return; }
    const surfaceDoc = await db.collection(SURFACES_COLLECTION).doc(surfaceId).get();
    if (!surfaceDoc.exists) { res.status(404).json({ error: 'Surface not found' }); return; }
    const accountDoc = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
    if (!accountDoc.exists) { res.status(404).json({ error: 'Account not found' }); return; }
    const surface = surfaceDoc.data() as any;
    const account = accountDoc.data() as any;
    const existingSnap = await db.collection(MARKETPLACE_LISTINGS_COLLECTION)
      .where('surfaceId', '==', surfaceId)
      .where('accountId', '==', accountId)
      .limit(1).get();
    if (!existingSnap.empty) {
      res.status(400).json({ error: 'A listing already exists for this surface on this account' }); return;
    }
    const now = new Date().toISOString();
    const data = {
      surfaceId,
      accountId,
      platform: account.platform,
      status: 'pending',
      title: surface.title || '',
      price: surface.retailPrice || 0,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(MARKETPLACE_LISTINGS_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[Surfaces] POST listing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/surfaces/listings/:listingId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { listingId } = req.params;
    const doc = await db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Listing not found' }); return; }
    await db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Surfaces] DELETE listing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Sync Jobs ---

app.get('/admin/surfaces/jobs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, listingId } = req.query;
    let query: any = db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION);
    if (status) query = query.where('status', '==', status);
    if (listingId) query = query.where('listingId', '==', listingId);
    const snapshot = await query.get();
    const jobs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    jobs.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(jobs);
  } catch (error: any) {
    console.error('[Surfaces] GET jobs error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/jobs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { listingId, action } = req.body;
    if (!listingId || !action) { res.status(400).json({ error: 'listingId and action are required' }); return; }
    if (!VALID_JOB_ACTIONS.has(action)) { res.status(400).json({ error: `Invalid action. Must be one of: ${[...VALID_JOB_ACTIONS].join(', ')}` }); return; }
    const listingDoc = await db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).get();
    if (!listingDoc.exists) { res.status(404).json({ error: 'Listing not found' }); return; }
    const listing = listingDoc.data() as any;
    const now = new Date().toISOString();
    const data = {
      listingId,
      surfaceId: listing.surfaceId,
      accountId: listing.accountId,
      platform: listing.platform,
      action,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION).add(data);
    await db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).update({ status: 'syncing', lastSyncJobId: docRef.id, updatedAt: now });
    res.json({ id: docRef.id, ...data });

    executeSyncJob(docRef.id).catch((err) =>
      console.error(`[Surfaces] Async sync execution failed for job ${docRef.id}:`, err)
    );
  } catch (error: any) {
    console.error('[Surfaces] POST job error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/surfaces/jobs/:jobId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    const doc = await db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Job not found' }); return; }
    const updates: Record<string, any> = {};
    const allowed = ['status', 'attempts', 'lastAttemptAt', 'completedAt', 'errorMessage', 'result'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId).update(updates);
    res.json({ id: jobId, ...doc.data(), ...updates });
  } catch (error: any) {
    console.error('[Surfaces] PATCH job error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/jobs/:jobId/retry', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    const result = await retryFailedJob(jobId);
    if (!result.success) { res.status(400).json({ error: result.error }); return; }
    res.json({ id: jobId, status: 'queued', message: 'Job re-queued for retry' });
  } catch (error: any) {
    console.error('[Surfaces] POST job retry error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/jobs/process-retries', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const processed = await processRetryQueue();
    res.json({ processed, message: `Processed ${processed} retry job(s)` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Surfaces] POST process-retries error:', error);
    res.status(500).json({ error: msg });
  }
});

// --- Sync Logs ---

app.get('/admin/surfaces/logs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId, listingId, level } = req.query;
    let query: any = db.collection(MARKETPLACE_SYNC_LOGS_COLLECTION);
    if (jobId) query = query.where('jobId', '==', jobId);
    if (listingId) query = query.where('listingId', '==', listingId);
    if (level) query = query.where('level', '==', level);
    const snapshot = await query.get();
    const logs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    logs.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(logs);
  } catch (error: any) {
    console.error('[Surfaces] GET logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/logs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId, listingId, accountId, platform, level, message, details } = req.body;
    if (!jobId || !message) { res.status(400).json({ error: 'jobId and message are required' }); return; }
    const resolvedLevel = level && VALID_LOG_LEVELS.has(level) ? level : 'info';
    const now = new Date().toISOString();
    const data = {
      jobId,
      listingId: listingId || '',
      accountId: accountId || '',
      platform: platform && VALID_PLATFORMS.has(platform) ? platform : undefined,
      level: resolvedLevel,
      message,
      details: details || undefined,
      createdAt: now,
    };
    const docRef = await db.collection(MARKETPLACE_SYNC_LOGS_COLLECTION).add(data);
    res.json({ id: docRef.id, ...data });
  } catch (error: any) {
    console.error('[Surfaces] POST log error:', error);
    res.status(500).json({ error: error.message });
  }
});


  }
