import { validateEtsySettings } from '../../../shared/etsy';
import { etsyCredentials, getEtsySetupOptions, validateEtsyShopSettings } from '../services/etsy-api';
import { amazonCredentials, getAmazonSetupOptions, validateAmazonSettings, buildAmazonSubmissions, previewAmazonSubmissions, amazonProductFromSurface } from '../services/amazon-sp-api';
import { getEbaySetupOptions, createEbayInventoryLocation } from '../services/ebay-api';
import { resolveMarketplaceVariants } from '../services/marketplace-variants';
import { publicMarketplaceAccount } from '../services/marketplace-oauth';
import { refreshListingFees, listingWithFees } from '../services/marketplace-fees';
import { Request, Response } from 'express';
import express from 'express';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import { getOrCreateMarketplaceListing, runMarketplaceJob, retryFailedJob, processRetryQueue, MarketplaceError } from '../services/marketplace-sync';
import { normalizeProductForPublishing, marketplaceSelectionErrors, createSurfaceDraftFromNormalizedProduct, resolveAndNormalizeForPublishing } from '../services/surface-generator';
import type { SupportedMarketplace, GenerateDefaults } from '../services/surface-generator';
import {
  SURFACES_COLLECTION,
  SURFACE_VARIANTS_COLLECTION,
  MARKETPLACE_ACCOUNTS_COLLECTION,
  MARKETPLACE_LISTINGS_COLLECTION,
  MARKETPLACE_SYNC_JOBS_COLLECTION,
  MARKETPLACE_SYNC_LOGS_COLLECTION,
  MARKETPLACE_PLATFORMS,
} from '../constants';
import { isValidQrgCode } from '../../../shared/qrgCodes';

const VALID_PLATFORMS = new Set<string>(MARKETPLACE_PLATFORMS);
const VALID_SURFACE_STATUSES = new Set<string>(['draft', 'ready', 'published', 'archived']);
const VALID_LISTING_STATUSES = new Set<string>(['pending', 'draft', 'active', 'syncing', 'error', 'paused', 'delisted']);
const VALID_JOB_ACTIONS = new Set<string>(['create', 'update', 'delete', 'sync_inventory', 'full_sync', 'check_status']);

  export function register(app: express.Express): void {



// ============ CANONICAL SURFACES SYSTEM ============

// --- Marketplace Accounts ---

app.get('/admin/surfaces/accounts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).get();
    const accounts = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return publicMarketplaceAccount(data, doc.id);
    });
    accounts.sort((a: any, b: any) => (a.accountName || '').localeCompare(b.accountName || ''));
    res.json(accounts);
  } catch (error: any) {
    console.error('[Surfaces] GET accounts error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/accounts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform, accountName, shopId, shopName } = req.body;
    if (req.body.feePercent !== undefined) { res.status(400).json({ error: 'Fees belong to individual listings and are retrieved from the marketplace.' }); return; }
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
    if (req.body.feePercent !== undefined) { res.status(400).json({ error: 'Fees belong to individual listings and are retrieved from the marketplace.' }); return; }
    if (req.body.platform !== undefined && req.body.platform !== doc.data()!.platform) { res.status(400).json({ error: 'Create a separate account to use another marketplace.' }); return; }
    const allowed = ['accountName', 'shopId', 'shopName', 'isActive'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return; }
    updates.updatedAt = new Date().toISOString();
    await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update(updates);
    res.json(publicMarketplaceAccount({ ...doc.data(), ...updates }, accountId));
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
    await db.runTransaction(async tx => {
      const linked = await tx.get(db.collection(MARKETPLACE_LISTINGS_COLLECTION).where('surfaceId', '==', surfaceId));
      if (linked.docs.some(row => row.data().status === 'syncing')) throw new MarketplaceError('Wait for this item’s running job before saving setup.', 409);
      tx.update(db.collection(SURFACES_COLLECTION).doc(surfaceId), updates);
    });
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
    if (!surface.sku || surface.sku.trim().length === 0) {
      errors.push('Missing valid QRG code');
    } else if (!isValidQrgCode(surface.sku.trim())) {
      errors.push(`Invalid QRG code format: "${surface.sku}" — must match QRG-[STNNN]-[C]-[NNNNNN] or QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]`);
    }
    const enabledVariants = variants.filter((v: any) => v.enabled);
    try {
      const product = await normalizeProductForPublishing(surface.masterProductId, db);
      if (product.sku !== surface.sku) errors.push('Surface QRG identity does not match its product.');
      if (surface.enabledPlatforms?.length && surface.enabledPlatforms.every((platform: string) => ['amazon', 'ebay', 'etsy'].includes(platform))) {
        if (variants.length) errors.push('Legacy surface variants need reconciliation with the built product.');
        await resolveMarketplaceVariants(product, db);
      } else errors.push(...marketplaceSelectionErrors(product, variants.length > 0));
    } catch (error: any) { errors.push(error.message); }
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
    if (surface.enabledPlatforms?.includes('ebay')) {
      const eb = surface.ebay || {};
      if (!eb.categoryId || !String(eb.categoryId).trim()) {
        errors.push('eBay: Category ID is required (ebay.categoryId)');
      }
      if (!eb.conditionId || !String(eb.conditionId).trim()) {
        errors.push('eBay: Condition ID is required (ebay.conditionId)');
      }
      if (eb.listingFormat !== 'FIXED_PRICE') {
        errors.push('eBay: This connection requires fixed-price listings.');
      }
      // At least one aspect/identifier must be known — brand from common or itemSpecifics
      const hasBrand = (surface.brand && surface.brand.trim()) || (eb.brand && eb.brand.trim());
      const hasItemSpecifics = eb.itemSpecifics && Object.keys(eb.itemSpecifics).length > 0;
      if (!hasBrand && !hasItemSpecifics) {
        errors.push('eBay: At least a Brand or one item specific is required for eBay aspects');
      }

    }

    const newStatus = surface.status === 'published' ? 'published' : errors.length === 0 ? 'ready' : 'draft';
    await db.collection(SURFACES_COLLECTION).doc(surfaceId).update({ readinessErrors: errors, status: newStatus, updatedAt: new Date().toISOString() });
    res.json({ ready: errors.length === 0, errors, status: newStatus, ...(surface.enabledPlatforms?.some((platform: string) => ['ebay', 'amazon', 'etsy'].includes(platform)) ? { note: 'Item checks only. Marketplace Setup and publishing validate the selected seller requirements.' } : {}) });
  } catch (error: any) {
    console.error('[Surfaces] POST check-readiness error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Generate Surface from Built Product ---

app.post('/admin/surfaces/generate-from-instance', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId, qrgCode, marketplace = 'ebay', defaults = {} } = req.body;

    if (!instanceId && !qrgCode) {
      res.status(400).json({ error: 'Either instanceId or qrgCode is required' });
      return;
    }

    const validMarketplaces = new Set<string>(['ebay', 'etsy', 'amazon']);
    if (!validMarketplaces.has(marketplace)) {
      res.status(400).json({ error: `Invalid marketplace. Must be one of: ebay, etsy, amazon` });
      return;
    }

    // resolveAndNormalizeForPublishing handles both paths:
    // qrgCode → resolve instance → normalize
    // instanceId-only → normalize directly
    // Both → resolve qrgCode, cross-validate instanceId must match
    const normalized = await resolveAndNormalizeForPublishing(
      { qrgCode: qrgCode?.trim(), productInstanceId: instanceId?.trim() },
      db,
    );

    const surfacePayload = createSurfaceDraftFromNormalizedProduct(
      normalized,
      marketplace as SupportedMarketplace,
      defaults as GenerateDefaults,
    );

    const docRef = await db.collection(SURFACES_COLLECTION).add(surfacePayload);

    const resolvedInstanceId = normalized.instanceId;
    console.log(`[SurfaceGenerator] Created surface ${docRef.id} from instance ${resolvedInstanceId} (sku: ${normalized.sku})`);
    res.json({ success: true, surfaceId: docRef.id, instanceId: resolvedInstanceId, qrgCode: normalized.sku, marketplace });
  } catch (error: any) {
    console.error('[SurfaceGenerator] generate-from-instance error:', error.message);
    const isValidation = /invalid qrg|no product instance|multiple product instance|qrg code does not match|either qrgcode or productinstanceid|either instanceid or qrgcode/i.test(error.message || '');
    res.status(isValidation ? 400 : 500).json({ error: error.message });
  }
});

// Both direct Push and Listings use the same account, lock, job and result records.
for (const platform of MARKETPLACE_PLATFORMS) {
  app.post(`/admin/surfaces/:surfaceId/push-to-${platform}`, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { accountId } = req.body;
      if (typeof accountId !== 'string' || !accountId) throw new MarketplaceError('accountId is required.');
      const listing = await getOrCreateMarketplaceListing(req.params.surfaceId, accountId, platform);
      const result = await runMarketplaceJob(listing.id, 'full_sync', platform === 'etsy' ? req.body : {});
      res.json({ ...result, surfaceId: req.params.surfaceId, accountId, marketplaceListingId: listing.id });
    } catch (error: any) {
      console.error('[Marketplace] Push failed:', error.message);
      res.status(error instanceof MarketplaceError ? error.status : 500).json({ error: error.message });
    }
  });
}

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
    res.json(await Promise.all(listings.map(listingWithFees)));
  } catch (error: any) {
    console.error('[Surfaces] GET listings error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/listings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId, accountId } = req.body;
    if (typeof surfaceId !== 'string' || typeof accountId !== 'string' || !surfaceId || !accountId) throw new MarketplaceError('surfaceId and accountId are required.');
    res.json(await getOrCreateMarketplaceListing(surfaceId, accountId));
  } catch (error: any) {
    console.error('[Marketplace] Create listing failed:', error.message);
    res.status(error instanceof MarketplaceError ? error.status : 500).json({ error: error.message });
  }
});

async function etsySetupContext(listingId: string) {
  const listingRef = db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId), snap = await listingRef.get();
  if (!snap.exists) throw new MarketplaceError('Listing not found.', 404);
  const listing = snap.data()!;
  if (listing.platform !== 'etsy') throw new MarketplaceError('This is not an Etsy listing.');
  const accountRef = db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(listing.accountId), account = (await accountRef.get()).data();
  const credentials = etsyCredentials(account || {});
  const surface = (await db.collection(SURFACES_COLLECTION).doc(listing.surfaceId).get()).data();
  if (!surface) throw new MarketplaceError('Item setup is missing.', 404);
  const product = await normalizeProductForPublishing(surface.masterProductId, db);
  if (product.sku !== surface.sku || listing.marketplaceSku !== surface.sku) throw new MarketplaceError('Listing and product identity do not match.');
  const variants = await resolveMarketplaceVariants(product, db);
  const persist = async (token: string) => { await accountRef.update({ etsyRefreshToken: token, updatedAt: new Date().toISOString() }); };
  return { listingRef, listing, surface, variants, credentials, persist };
}
app.get('/admin/surfaces/listings/:listingId/etsy-setup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const context = await etsySetupContext(req.params.listingId);
    const options = await getEtsySetupOptions(context.credentials, context.persist);
    res.json({ options, variants: context.variants, settings: context.listing.publishOptions || {}, shopName: context.credentials.shopName });
  } catch (error: any) { console.error('[Etsy setup] Load failed:', error.message); res.status(error instanceof MarketplaceError ? error.status : 502).json({ error: error.message }); }
});
app.patch('/admin/surfaces/listings/:listingId/etsy-setup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = validateEtsySettings(req.body.settings), context = await etsySetupContext(req.params.listingId);
    validateEtsyShopSettings(settings, await getEtsySetupOptions(context.credentials, context.persist), context.surface.currency || 'USD');
    await db.runTransaction(async tx => {
      const snap = await tx.get(context.listingRef);
      if (!snap.exists || snap.data()!.status === 'syncing') throw new MarketplaceError('Wait for the running job before saving setup.', 409);
      if (snap.data()!.accountId !== context.listing.accountId) throw new MarketplaceError('Seller changed. Reload setup.', 409);
      tx.update(context.listingRef, { publishOptions: settings, updatedAt: new Date().toISOString() });
    });
    res.json({ success: true });
  } catch (error: any) { console.error('[Etsy setup] Save failed:', error.message); res.status(error instanceof MarketplaceError ? error.status : 400).json({ error: error.message }); }
});

async function amazonSetupContext(listingId: string) {
  const listingRef = db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId), listingDoc = await listingRef.get();
  if (!listingDoc.exists) throw new MarketplaceError('Listing not found.', 404);
  const listing = listingDoc.data()!;
  if (listing.platform !== 'amazon') throw new MarketplaceError('This is not an Amazon listing.');
  const account = (await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(listing.accountId).get()).data();
  if (!account?.isActive || account.platform !== 'amazon' || !account.amazonConnected) throw new MarketplaceError('Connect this Amazon seller account first.');
  const surfaceRef = db.collection(SURFACES_COLLECTION).doc(listing.surfaceId), surfaceDoc = await surfaceRef.get();
  if (!surfaceDoc.exists) throw new MarketplaceError('Item setup is missing.', 404);
  const surface = surfaceDoc.data()!, product = await normalizeProductForPublishing(surface.masterProductId, db);
  if (product.sku !== surface.sku || listing.marketplaceSku !== surface.sku) throw new MarketplaceError('Listing and product identity do not match.');
  if (!(await db.collection(SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', listing.surfaceId).get()).empty) throw new MarketplaceError('Legacy surface variants need reconciliation with the built product.');
  const variants = await resolveMarketplaceVariants(product, db);
  return { listingRef, listing, surfaceRef, surface, variants, credentials: amazonCredentials(account) };
}
app.get('/admin/surfaces/listings/:listingId/amazon-setup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const context = await amazonSetupContext(req.params.listingId);
    const productType = typeof req.query.productType === 'string' ? req.query.productType : context.listing.publishOptions?.amazon?.productType || '';
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const options = await getAmazonSetupOptions(context.credentials, productType, query, context.variants.length > 0);
    res.json({ options, productType, variants: context.variants, settings: context.listing.publishOptions?.amazon || { productType: '', quantity: 0, attributes: {} } });
  } catch (error: any) { res.status(error instanceof MarketplaceError ? error.status : 502).json({ error: error.message }); }
});
app.patch('/admin/surfaces/listings/:listingId/amazon-setup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const context = await amazonSetupContext(req.params.listingId), settings = validateAmazonSettings(req.body.settings);
    await db.runTransaction(async tx => {
      const snap = await tx.get(context.listingRef);
      if (!snap.exists || snap.data()!.status === 'syncing') throw new MarketplaceError('Wait for the running job before saving setup.', 409);
      if (snap.data()!.accountId !== context.listing.accountId) throw new MarketplaceError('Seller changed. Reload setup.', 409);
      tx.update(context.listingRef, { publishOptions: { ...snap.data()!.publishOptions, amazon: settings }, updatedAt: new Date().toISOString() });
    });
    res.json({ success: true });
  } catch (error: any) { res.status(error instanceof MarketplaceError ? error.status : 400).json({ error: error.message }); }
});
app.post('/admin/surfaces/listings/:listingId/amazon-preview', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const context = await amazonSetupContext(req.params.listingId), settings = validateAmazonSettings(req.body.settings);
    const options = await getAmazonSetupOptions(context.credentials, settings.productType, '', context.variants.length > 0);
    const submissions = buildAmazonSubmissions(amazonProductFromSurface(context.surface), context.surface.sku, settings, context.variants, options);
    const errors = await previewAmazonSubmissions(context.credentials, submissions);
    res.json({ valid: errors.length === 0, errors });
  } catch (error: any) { res.status(error instanceof MarketplaceError ? error.status : 502).json({ error: error.message }); }
});

async function ebaySetupContext(listingId: string) {
  const listingRef = db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId), listingDoc = await listingRef.get();
  if (!listingDoc.exists) throw new MarketplaceError('Listing not found.', 404);
  const listing = listingDoc.data()!;
  if (listing.platform !== 'ebay') throw new MarketplaceError('This is not an eBay listing.');
  const accountDoc = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(listing.accountId).get(), account = accountDoc.data();
  if (!account?.isActive || account.platform !== 'ebay' || !account.ebayConnected || !account.ebayRefreshToken) throw new MarketplaceError('Connect this eBay seller account first.');
  const surfaceRef = db.collection(SURFACES_COLLECTION).doc(listing.surfaceId), surfaceDoc = await surfaceRef.get();
  if (!surfaceDoc.exists) throw new MarketplaceError('Item setup is missing.', 404);
  return { listingRef, listing, surfaceRef, surface: surfaceDoc.data()!, credentials: { userId: account.ebayUserId || '', username: account.ebayUsername || '', refreshToken: account.ebayRefreshToken } };
}

app.get('/admin/surfaces/listings/:listingId/ebay-setup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const context = await ebaySetupContext(req.params.listingId);
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : context.surface.ebay?.categoryId || '';
    const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    const options = await getEbaySetupOptions(context.credentials, categoryId, query);
    const product = await normalizeProductForPublishing(context.surface.masterProductId, db);
    const variants = await resolveMarketplaceVariants(product, db);
    res.json({ options, variants, settings: context.listing.publishOptions?.ebay || {}, categoryId, itemSpecifics: context.surface.ebay?.itemSpecifics || {} });
  } catch (error: any) { res.status(error instanceof MarketplaceError ? error.status : 502).json({ error: error.message }); }
});

app.post('/admin/surfaces/listings/:listingId/ebay-location', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const context = await ebaySetupContext(req.params.listingId);
    const { name, postalCode, country } = req.body;
    if ([name, postalCode, country].some(value => typeof value !== 'string')) throw new MarketplaceError('Location name, postal code and country are required.');
    res.json(await createEbayInventoryLocation(context.credentials, context.listing.accountId, { name, postalCode, country }));
  } catch (error: any) { res.status(error instanceof MarketplaceError ? error.status : 502).json({ error: error.message }); }
});

app.patch('/admin/surfaces/listings/:listingId/ebay-setup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const context = await ebaySetupContext(req.params.listingId);
    const settings: Record<string, any> = {};
    for (const key of ['fulfillmentPolicyId', 'paymentPolicyId', 'returnPolicyId', 'merchantLocationKey']) {
      if (typeof req.body.settings?.[key] !== 'string' || !req.body.settings[key].trim()) throw new MarketplaceError('Choose all three seller policies and an inventory location.');
      settings[key] = req.body.settings[key].trim();
    }
    if (req.body.settings.variationValues !== undefined) {
      const mappings = req.body.settings.variationValues;
      if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings) || Object.keys(mappings).some(key => !['Size', 'Color'].includes(key))) throw new MarketplaceError('Invalid eBay variation mappings.');
      for (const values of Object.values(mappings)) {
        if (!values || typeof values !== 'object' || Array.isArray(values) || Object.values(values).some(value => typeof value !== 'string' || !value.trim())) throw new MarketplaceError('Variation mappings must contain text values.');
      }
      settings.variationValues = mappings;
    }
    const categoryId = String(req.body.categoryId || '').trim();
    if (!/^\d+$/.test(categoryId)) throw new MarketplaceError('Choose an eBay category.');
    const itemSpecifics = req.body.itemSpecifics;
    if (!itemSpecifics || typeof itemSpecifics !== 'object' || Array.isArray(itemSpecifics) || Object.values(itemSpecifics).some(value => typeof value !== 'string')) throw new MarketplaceError('Item specifics must contain text values.');
    // Check ownership against the selected seller before writing settings.
    const options = await getEbaySetupOptions(context.credentials, categoryId);
    for (const [field, rows] of [['fulfillmentPolicyId', options.fulfillmentPolicies], ['paymentPolicyId', options.paymentPolicies], ['returnPolicyId', options.returnPolicies], ['merchantLocationKey', options.locations]] as const) {
      if (!rows.some((row: any) => row[field] === settings[field])) throw new MarketplaceError(`Selected ${field} is not available for this seller.`);
    }
    await db.runTransaction(async tx => {
      const listingDoc = await tx.get(context.listingRef), surfaceDoc = await tx.get(context.surfaceRef);
      const linked = await tx.get(db.collection(MARKETPLACE_LISTINGS_COLLECTION).where('surfaceId', '==', context.listing.surfaceId));
      if (!listingDoc.exists || !surfaceDoc.exists || linked.docs.some(doc => doc.data().status === 'syncing')) throw new MarketplaceError('Wait for this item’s running job before saving setup.', 409);
      if (listingDoc.data()!.accountId !== context.listing.accountId) throw new MarketplaceError('Seller changed. Reload setup.', 409);
      const ebay = { ...surfaceDoc.data()!.ebay, categoryId, itemSpecifics, listingFormat: 'FIXED_PRICE' };
      for (const key of ['shippingPolicyId', 'returnsPolicyId', 'paymentPolicyId', 'merchantLocationKey']) delete ebay[key];
      const timestamp = new Date().toISOString();
      tx.update(context.surfaceRef, { ebay, updatedAt: timestamp });
      tx.update(context.listingRef, { publishOptions: { ...listingDoc.data()!.publishOptions, ebay: settings }, updatedAt: timestamp });
    });
    res.json({ success: true });
  } catch (error: any) { res.status(error instanceof MarketplaceError ? error.status : 502).json({ error: error.message }); }
});

app.post('/admin/surfaces/listings/:listingId/fees', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(req.params.listingId);
    if (!(await ref.get()).exists) { res.status(404).json({ error: 'Listing not found' }); return; }
    const fees = await refreshListingFees(req.params.listingId);
    res.status(fees.status === 'unavailable' ? 422 : 200).json({ fees, ...(fees.status === 'unavailable' ? { error: fees.reason } : {}) });
  } catch (error: any) {
    console.error('[Marketplace fees] Refresh failed:', error.message);
    res.status(409).json({ error: 'Could not refresh fees. Reload this item and retry.' });
  }
});

app.delete('/admin/surfaces/listings/:listingId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { listingId } = req.params;
    const doc = await db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).get();
    if (!doc.exists) { res.status(404).json({ error: 'Listing not found' }); return; }
    if (doc.data()?.amazonItems?.length || doc.data()?.externalListingId || doc.data()?.externalOfferId || doc.data()?.externalCreateAttempted || doc.data()?.status === 'syncing') {
      res.status(409).json({ error: 'This record tracks an external listing or an in-progress attempt and cannot be removed.' }); return;
    }
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
    if (typeof listingId !== 'string' || !listingId || !VALID_JOB_ACTIONS.has(action)) throw new MarketplaceError('A listingId and valid action are required.');
    res.json(await runMarketplaceJob(listingId, action));
  } catch (error: any) {
    console.error('[Marketplace] Job failed:', error.message);
    res.status(error instanceof MarketplaceError ? error.status : 500).json({ error: error.message });
  }
});

app.post('/admin/surfaces/jobs/:jobId/retry', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    const result = await retryFailedJob(jobId);
    res.json(result);
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


  }
