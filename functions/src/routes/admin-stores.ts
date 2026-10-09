import { registerStoreAdminRoutes } from '../services/store-admin';
import { createStore, createStoreChannel, deleteStore, deleteStoreChannel } from '../services/store-channels';
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
  registerStoreAdminRoutes(app, '', requireAdmin, () => db, () => admin.firestore.FieldValue.serverTimestamp());
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

// Delete any channel directly by ID (no storeId required)




// Admin: Delete a collection (soft-deletes all catalog instances in it)

// Admin: Get collections for a store channel

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
    const legacyProducts = legacySnap.docs.filter((doc: any) => doc.data().isVisible !== false && !['deleted', 'archived'].includes(doc.data().status)).map((doc: any) => {
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
