import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { MOSAIC_TEMPLATES_COLLECTION } from '../constants';
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
  // ============ ADMIN STORES (stores + storeChannels collections) ============

app.get('/admin/stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const roleType = req.query.roleType as string;
    let query: any = db.collection('stores');
    if (roleType) query = query.where('roleType', '==', roleType);
    const snapshot = await query.get();
    const stores = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    stores.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    res.json(stores);
  } catch (error: any) {
    console.error('[Stores] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
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
  } catch (error: any) {
    console.error('[Stores] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/stores/:storeId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const channelsSnapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
    const batch = db.batch();
    channelsSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
    batch.delete(db.collection('stores').doc(storeId));
    await batch.commit();
    res.json({ success: true, deletedChannels: channelsSnapshot.size });
  } catch (error: any) {
    console.error('[Stores] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/stores/by-id/:storeId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    let doc = await db.collection('stores').doc(storeId).get();
    if (doc.exists) {
      const data = doc.data();
      res.json({ id: doc.id, name: data?.name || storeId, type: data?.roleType || 'internal', roleType: data?.roleType || 'internal', isActive: data?.isActive ?? true });
      return;
    }
    doc = await db.collection('partnerStores').doc(storeId).get();
    if (doc.exists) {
      const data = doc.data();
      res.json({ id: doc.id, name: data?.name || storeId, type: data?.isInternal ? 'internal' : 'external', roleType: data?.isInternal ? 'internal' : 'external', isActive: data?.isActive ?? true, isPartnerStore: true });
      return;
    }
    res.status(404).json({ error: 'Store not found' });
  } catch (error: any) {
    console.error('[Stores] GET by-id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List ALL channels across all stores (with store name, including orphaned)
app.get('/admin/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('storeChannels').get();
    const storeIds = [...new Set(snapshot.docs.map((d: any) => d.data().storeId).filter(Boolean))] as string[];
    const storeMap: Record<string, string> = {};
    for (const id of storeIds) {
      const doc = await db.collection('stores').doc(id).get();
      storeMap[id] = doc.exists ? ((doc.data() as any)?.name || id) : `(orphaned)`;
    }
    const channels = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      storeName: storeMap[doc.data().storeId] || `(orphaned)`,
      storeExists: !!storeMap[doc.data().storeId] && !storeMap[doc.data().storeId].includes('orphaned'),
    }));
    channels.sort((a: any, b: any) => (a.storeName || '').localeCompare(b.storeName || '') || (a.name || '').localeCompare(b.name || ''));
    res.json(channels);
  } catch (error: any) {
    console.error('[AllChannels] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete any channel directly by ID (no storeId required)
app.delete('/admin/channels/:channelId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params;
    await db.collection('storeChannels').doc(channelId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[AllChannels] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/stores/:storeId/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const snapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
    const channels = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    channels.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(channels);
  } catch (error: any) {
    console.error('[Channels] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/stores/:storeId/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Channel name is required' }); return; }
    const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const channelData = { name: name.trim(), storeId, isActive: true, productCount: 0, createdAt: new Date().toISOString() };
    await db.collection('storeChannels').doc(channelId).set(channelData);
    res.json({ id: channelId, ...channelData });
  } catch (error: any) {
    console.error('[Channels] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/stores/:storeId/channels/:channelId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Soft-delete every catalog instance in this channel so the public store
    // stops showing them immediately without permanently destroying data.
    const instancesSnap = await db.collection('admin_catalog_instances')
      .where('storeId', '==', storeId)
      .where('channelId', '==', channelId)
      .get();

    const batch = db.batch();
    instancesSnap.docs.forEach(doc => {
      batch.update(doc.ref, { isVisible: false, status: 'deleted', deletedAt: now });
    });
    batch.delete(db.collection('storeChannels').doc(channelId));
    await batch.commit();

    res.json({ success: true, archivedInstances: instancesSnap.size });
  } catch (error: any) {
    console.error('[Channels] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete a collection (soft-deletes all catalog instances in it)
app.delete('/admin/stores/:storeId/channels/:channelId/collections/:collectionName', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId, collectionName } = req.params;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const snap = await db.collection('admin_catalog_instances')
      .where('storeId', '==', storeId)
      .where('channelId', '==', channelId)
      .where('collectionName', '==', collectionName)
      .get();

    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { isVisible: false, status: 'deleted', deletedAt: now });
    });
    await batch.commit();

    res.json({ success: true, deleted: snap.size });
  } catch (error: any) {
    console.error('[Collections] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get collections for a store channel
app.get('/admin/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    if (!storeId || !channelId) {
      res.status(400).json({ error: 'storeId and channelId are required' });
      return;
    }

    const collectionsSet = new Set<string>();

    // 1. From admin_catalog_instances (primary source for Catalog tab)
    // Exclude soft-deleted instances so their collections don't appear in the sidebar.
    const instancesSnapshot = await db.collection('admin_catalog_instances')
      .where('storeId', '==', storeId)
      .where('channelId', '==', channelId)
      .get();
    instancesSnapshot.docs.forEach(doc => {
      const d = doc.data();
      if (d.isVisible === false || d.status === 'deleted') return;
      const col = d.collectionName;
      if (col) collectionsSet.add(col);
    });

    // 2. From storeProductLinks (legacy / store-facing products)
    const linksSnapshot = await db.collection('storeProductLinks')
      .where('storeId', '==', storeId)
      .where('channel', '==', channelId)
      .get();
    linksSnapshot.docs.forEach(doc => {
      const collection = doc.data().collection;
      if (collection) collectionsSet.add(collection);
    });

    // 3. From mosaic templates
    const explicitSnapshot = await db.collection(MOSAIC_TEMPLATES_COLLECTION)
      .where('storeId', '==', storeId)
      .where('channelId', '==', channelId)
      .get();
    explicitSnapshot.docs.forEach(doc => {
      const name = doc.data().name;
      if (name) collectionsSet.add(name);
    });

    const collections = Array.from(collectionsSet).sort();
    res.json({ success: true, collections, count: collections.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN PARTNER STORES ============

app.get('/admin/partner-stores', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/partner-stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('partnerStores').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('partnerStores').doc(req.params.id).update(req.body);
    const doc = await db.collection('partnerStores').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('partnerStores').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/partner-stores/:id/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStoreProducts')
      .where('storeId', '==', req.params.id)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/partner-stores/:id/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('partnerStoreProducts').add({
      ...req.body,
      storeId: req.params.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Store Library: products assigned to a channel — admin_catalog_instances is the primary source
app.get('/admin/stores/:storeId/channels/:channelName/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelName } = req.params;

    // Primary: admin_catalog_instances — the committed source of truth
    const snap = await db.collection('admin_catalog_instances')
      .where('storeId', '==', storeId)
      .get();

    const instances = snap.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((d: any) => {
        // Exclude soft-deleted / hidden / archived
        if (d.isVisible === false || d.status === 'deleted' || d.status === 'archived') return false;
        // Match channel by ID or name (URL param may be either)
        return d.channelId === channelName || d.channelName === channelName;
      });

    if (instances.length > 0) {
      console.log(`[Store Library] ${storeId}/${channelName}: ${instances.length} catalog instances`);
      const products = instances.map((d: any) => {
        const resolved = d.resolved || {};
        const rawImg = resolved.images?.[0];
        const imageUrl = typeof rawImg === 'string' ? rawImg : (rawImg?.url || '');
        return {
          id: d.id,
          linkId: d.id,
          instanceId: d.id,
          packetId: d.currentPacketId || null,
          currentPacketId: d.currentPacketId || null,
          templateId: d.currentTemplateId || null,
          name: resolved.title || 'Untitled',
          imageUrl,
          enabledColors: d.enabledColors || [],
          enabledSizes: d.enabledSizes || [],
          defaultColor: d.defaultColor || null,
          pricing: resolved.pricing || null,
          collectionName: d.collectionName || null,
          status: d.status || 'active',
          isVisible: d.isVisible !== false,
          publishStatus: d.publishStatus || null,
          lastPublishedAt: d.lastPublishedAt?.toDate?.()?.toISOString() || d.lastPublishedAt || null,
          publishError: d.publishError || null,
          printifyProductId: d.printifyProductId || null,
        };
      });
      res.json(products);
      return;
    }

    // Legacy fallback: storeProductLinks (for any pre-instance products)
    console.log(`[Store Library] ${storeId}/${channelName}: no instances found, falling back to storeProductLinks`);
    const legacySnap = await db.collection('storeProductLinks')
      .where('storeId', '==', storeId)
      .where('channel', '==', channelName)
      .get();
    const legacyProducts = legacySnap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        linkId: doc.id,
        packetId: d.packetId || null,
        templateId: d.templateId || null,
        name: d.productName || d.name || 'Untitled',
        imageUrl: d.mockupUrl || d.compositeUrl || d.qrOnlyUrl || '',
        baseProductId: d.baseProductId || null,
        enabledColors: d.enabledColors || [],
        enabledSizes: d.enabledSizes || [],
        selectedGraphicSize: d.selectedGraphicSize || null,
        defaultColor: d.defaultColor || null,
        qrContent: d.qrContent || null,
        pricing: d.pricing || null,
      };
    });
    res.json(legacyProducts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


  }
  // deploy-force: 1777827061
