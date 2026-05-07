import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF, normalizePrintfulCategory } from '../core';
import { STORE_PRODUCT_LINKS_COLLECTION } from '../constants';
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


import { registerPpCatalogBrowseRoutes } from './pp-catalog-browse';

  export function register(app: express.Express): void {
  registerPpCatalogBrowseRoutes(app);
// ============ PRODUCTS PAGE: STORE-PRODUCT-LINKS CRUD ============

app.get('/admin/store-product-links', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const linksSnapshot = await db.collection(STORE_PRODUCT_LINKS_COLLECTION).orderBy("createdAt", "desc").limit(100).get();
    const links = linksSnapshot.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    }));
    console.log(`[Store Links] Listed ${links.length} total links`);
    res.json({ success: true, links, count: links.length });
  } catch (error: any) {
    console.error("[Store Links] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/store-product-links', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      storeId, storeName, channel, collection, packetId, templateId, graphicsId,
      qrContent, productName, compositeUrl, qrOnlyUrl, pricing,
      enabledColors, enabledSizes, selectedGraphicSize, defaultColor,
      qrProductState, landingPageUrl, mockupUrl, assemblyId: bodyAssemblyId
    } = req.body;
    if (!storeId || !channel) { res.status(400).json({ error: "storeId and channel are required" }); return; }
    if (!packetId && !templateId && !graphicsId) { res.status(400).json({ error: "At least one of packetId, templateId, or graphicsId is required" }); return; }

    // ── Assembly guard: packet must be linked to an assembly before store assignment ──
    let resolvedAssemblyId: string | null = bodyAssemblyId || null;
    if (packetId) {
      const packetDoc = await db.collection('productPackets').doc(packetId).get();
      if (!packetDoc.exists) { res.status(404).json({ error: `Packet ${packetId} not found` }); return; }
      const packetData = packetDoc.data() as any;
      resolvedAssemblyId = packetData.assemblyId || bodyAssemblyId || null;
      if (!resolvedAssemblyId) {
        res.status(400).json({ error: "Cannot assign to store — packet is missing an assembly. Complete the QRG → BLD → GRF chain in the Library first." });
        return;
      }
    }
    // ── end assembly guard ────────────────────────────────────────────────────────────

    const now = admin.firestore.FieldValue.serverTimestamp();
    const linkData: Record<string, any> = {
      storeId, storeName: storeName || "", channel, collection: collection || null,
      packetId: packetId || null, templateId: templateId || null, graphicsId: graphicsId || null,
      qrContent: qrContent || null, productName: productName || null,
      compositeUrl: compositeUrl || null, qrOnlyUrl: qrOnlyUrl || null, pricing: pricing || null,
      enabledColors: enabledColors || [], enabledSizes: enabledSizes || [],
      selectedGraphicSize: selectedGraphicSize || null, defaultColor: defaultColor || null,
      qrProductState: qrProductState || null, landingPageUrl: landingPageUrl || null,
      mockupUrl: mockupUrl || null, assemblyId: resolvedAssemblyId, createdAt: now, updatedAt: now,
    };
    const linkRef = await db.collection(STORE_PRODUCT_LINKS_COLLECTION).add(linkData);
    console.log(`[Store Links] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);
    res.json({ success: true, linkId: linkRef.id, message: `Product linked to ${storeName || storeId} / ${channel}` });
  } catch (error: any) {
    console.error("[Store Links] Error creating link:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/stores/:storeId/channels/:channelId/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    if (!storeId || !channelId) { res.status(400).json({ error: "storeId and channelId are required" }); return; }
    const linksSnapshot = await db.collection(STORE_PRODUCT_LINKS_COLLECTION)
      .where("storeId", "==", storeId).where("channel", "==", channelId).get();
    const products = linksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, linkId: doc.id, packetId: data.packetId || null,
        templateId: data.templateId || null, name: data.productName || "Untitled Product",
        imageUrl: data.compositeUrl || data.qrOnlyUrl || null, mockupUrl: data.mockupUrl || null,
        qrContent: data.qrContent || null, pricing: data.pricing || null,
        enabledColors: data.enabledColors || [], enabledSizes: data.enabledSizes || [],
        selectedGraphicSize: data.selectedGraphicSize || null, defaultColor: data.defaultColor || null,
        collection: data.collection || null, qrProductState: data.qrProductState || null,
        landingPageUrl: data.landingPageUrl || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    console.log(`[Store Links] Found ${products.length} products for ${storeId}/${channelId}`);
    res.json(products);
  } catch (error: any) {
    console.error("[Store Links] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/store-product-links/:linkId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const updates = req.body;
    if (!linkId) { res.status(400).json({ error: "linkId is required" }); return; }
    const docRef = db.collection(STORE_PRODUCT_LINKS_COLLECTION).doc(linkId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Link not found" }); return; }
    await docRef.update({ ...stripUndef(updates), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`[Store Links PATCH] Updated link ${linkId}:`, Object.keys(updates));
    res.json({ success: true, linkId, message: "Link updated" });
  } catch (error: any) {
    console.error("[Store Links PATCH] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/store-product-links/:linkId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    if (!linkId) { res.status(400).json({ error: "linkId is required" }); return; }
    const docRef = db.collection(STORE_PRODUCT_LINKS_COLLECTION).doc(linkId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Link not found" }); return; }
    await docRef.delete();
    console.log(`[Store Links DELETE] Deleted link ${linkId}`);
    res.json({ success: true, linkId, message: "Link deleted" });
  } catch (error: any) {
    console.error("[Store Links DELETE] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: CATALOG SYNC ============

app.get('/admin/catalog/sync-status', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const syncId = req.query.syncId as string;
    if (syncId) {
      const syncDoc = await db.collection("catalogSyncs").doc(syncId).get();
      if (!syncDoc.exists) { res.status(404).json({ error: "Sync not found" }); return; }
      const syncData = syncDoc.data();
      let summary = null;
      if (syncData?.status === 'completed' && syncData?.errorMessage) {
        try { summary = JSON.parse(syncData.errorMessage); } catch {}
      }
      res.json({ id: syncDoc.id, ...syncData, summary });
      return;
    }
    const latestSnapshot = await db.collection("catalogSyncs").orderBy("startedAt", "desc").limit(1).get();
    if (latestSnapshot.empty) { res.json({ status: 'none', message: 'No sync has been run yet' }); return; }
    const latest = { id: latestSnapshot.docs[0].id, ...latestSnapshot.docs[0].data() };
    let summary = null;
    if ((latest as any).status === 'completed' && (latest as any).errorMessage) {
      try { summary = JSON.parse((latest as any).errorMessage); } catch {}
    }
    const bpSnapshot = await db.collection("printify_blueprints").limit(1).get();
    res.json({ ...latest, summary, totalBlueprints: bpSnapshot.size, isConfigured: printifyClient.isConfigured });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/catalog/sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const latestSnapshot = await db.collection("catalogSyncs").orderBy("startedAt", "desc").limit(1).get();
    if (!latestSnapshot.empty) {
      const latest = latestSnapshot.docs[0].data();
      if (latest.status === 'running') {
        const startedAt = latest.startedAt?.toDate?.()?.getTime() || 0;
        if (Date.now() - startedAt < 30 * 60 * 1000) {
          res.status(409).json({ error: "Sync already in progress", syncId: latestSnapshot.docs[0].id });
          return;
        }
        await latestSnapshot.docs[0].ref.update({ status: 'failed', errorMessage: 'Timed out - cleared as stale' });
      }
    }
    const syncRef = await db.collection("catalogSyncs").add({
      syncType: 'smart', status: 'running', blueprintsCount: 0, providersCount: 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ syncId: syncRef.id, status: 'started', message: 'Smart sync started' });
    (async () => {
      try {
        console.log('[SmartSync CF] Starting catalog sync...');
        const existingBpSnapshot = await db.collection("printify_blueprints").get();
        const existingBpMap = new Map<number, any>();
        for (const doc of existingBpSnapshot.docs) { existingBpMap.set(doc.data().id || parseInt(doc.id), doc); }
        const blueprints = await printifyClient.getCatalogBlueprints();
        console.log(`[SmartSync CF] Found ${blueprints.length} blueprints`);
        let bpAdded = 0, bpUpdated = 0, bpSkipped = 0;
        for (const bp of blueprints) {
          try {
            const existing = existingBpMap.get(bp.id);
            const existingData = existing?.data();
            const changed = !existingData || existingData.title !== bp.title || existingData.brand !== (bp.brand || null) || existingData.model !== (bp.model || null);
            if (changed || !existingData?.richDescription) {
              let richDescription = existingData?.richDescription || null;
              if (!richDescription) {
                try {
                  const details = await printifyClient.getBlueprintDetails(bp.id);
                  if (details && details.description) {
                    richDescription = details.description;
                  }
                  await new Promise(r => setTimeout(r, 200));
                } catch (detailErr: any) {
                  console.warn(`[SmartSync CF] Could not fetch details for bp ${bp.id}: ${detailErr.message}`);
                }
              }
              await db.collection("printify_blueprints").doc(String(bp.id)).set({
                id: bp.id, title: bp.title, description: bp.description || null,
                richDescription: richDescription || null,
                brand: bp.brand || null, model: bp.model || null,
                images: bp.images || null, primaryImageUrl: bp.images?.[0] || null,
                lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
              if (existingData) { bpUpdated++; } else { bpAdded++; }
            } else { bpSkipped++; }
            await new Promise(r => setTimeout(r, 50));
          } catch (bpError: any) { console.error(`[SmartSync CF] Error syncing bp ${bp.id}:`, bpError.message); }
        }
        const summary = { blueprints: { added: bpAdded, updated: bpUpdated, skipped: bpSkipped, total: blueprints.length } };
        await syncRef.update({
          status: 'completed', blueprintsCount: bpAdded + bpUpdated,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          errorMessage: JSON.stringify(summary),
        });
        console.log(`[SmartSync CF] Done:`, JSON.stringify(summary));
      } catch (error: any) {
        console.error('[SmartSync CF] Error:', error.message);
        await syncRef.update({ status: 'failed', errorMessage: error.message, completedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/catalog/sync-printful', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printfulClient.isConfigured) { res.status(503).json({ error: "Printful API key not configured" }); return; }
    const syncRef = await db.collection("catalogSyncs").add({
      syncType: 'printful', status: 'running', productsCount: 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ syncId: syncRef.id, status: 'started', message: "Printful catalog sync started in background" });
    (async () => {
      try {
        console.log('[Printful Sync CF] Starting full catalog sync...');
        const headers = { 'Authorization': `Bearer ${await getPrintfulApiKeyAsync()}`, 'Content-Type': 'application/json' };
        const catResp = await fetch('https://api.printful.com/products', { headers });
        if (!catResp.ok) throw new Error(`Printful catalog API error: ${catResp.status}`);
        const catData = await catResp.json();
        const products = catData.result || [];
        console.log(`[Printful Sync CF] Found ${products.length} products`);

        const existingSnap = await db.collection('printful_products').get();
        const existingMap = new Map<number, any>();
        existingSnap.forEach(doc => existingMap.set(parseInt(doc.id), doc.data()));

        let added = 0, updated = 0, skipped = 0;
        for (const product of products) {
          try {
            const pid = product.id;
            const existing = existingMap.get(pid);
            const category = normalizePrintfulCategory(product.type || '', product.title || '');

            let minPrice: string | null = null;
            let maxPrice: string | null = null;
            try {
              const detailResp = await fetch(`https://api.printful.com/products/${pid}`, { headers });
              if (detailResp.ok) {
                const detailData = await detailResp.json();
                const variants = detailData.result?.variants || [];
                if (variants.length > 0) {
                  const prices = variants.map((v: any) => parseFloat(v.price)).filter((p: number) => !isNaN(p) && p > 0);
                  if (prices.length > 0) {
                    minPrice = Math.min(...prices).toFixed(2);
                    maxPrice = Math.max(...prices).toFixed(2);
                  }
                }
              }
              await new Promise(r => setTimeout(r, 200));
            } catch (priceErr: any) {
              console.error(`[Printful Sync CF] Price fetch error for ${pid}:`, priceErr.message);
            }

            const productData: any = {
              id: pid, title: product.title, type: product.type, brand: product.brand || null,
              model: product.model || null, image: product.image || null,
              variantCount: product.variant_count || 0,
              category, description: product.description || null,
              isAvailable: true, lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (minPrice !== null) { productData.minPrice = minPrice; productData.maxPrice = maxPrice; }

            const changed = !existing || existing.title !== product.title || existing.brand !== (product.brand || null) || existing.variantCount !== (product.variant_count || 0) || !existing.minPrice;
            if (changed) {
              await db.collection('printful_products').doc(String(pid)).set(productData, { merge: true });
              if (existing) { updated++; } else { added++; }
            } else { skipped++; }
            await new Promise(r => setTimeout(r, 30));
          } catch (pErr: any) { console.error(`[Printful Sync CF] Error syncing product ${product.id}:`, pErr.message); }
        }

        const summary = { products: { added, updated, skipped, total: products.length } };
        await syncRef.update({
          status: 'completed', productsCount: added + updated,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          summary: JSON.stringify(summary),
        });
        console.log(`[Printful Sync CF] Done:`, JSON.stringify(summary));
      } catch (syncError: any) {
        console.error('[Printful Sync CF] Error:', syncError.message);
        await syncRef.update({ status: 'failed', errorMessage: syncError.message, completedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog/printful', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string || '').toLowerCase();
    const snapshot = await db.collection('printful_products').get();
    let products: any[] = [];
    snapshot.forEach(doc => products.push({ docId: doc.id, ...doc.data() }));
    if (search) {
      products = products.filter(p =>
        (p.title || '').toLowerCase().includes(search) ||
        (p.brand || '').toLowerCase().includes(search) ||
        (p.model || '').toLowerCase().includes(search) ||
        (p.category || '').toLowerCase().includes(search)
      );
    }
    res.json(products);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog/printful/:productId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseInt(req.params.productId);
    if (!printfulClient.isConfigured) { res.status(503).json({ error: "Printful API not configured" }); return; }
    const productData = await printfulClient.getProduct(productId);
    const printfileData = await printfulClient.getPrintfiles(productId).catch(() => null);
    const placements = printfileData?.available_placements ? Object.keys(printfileData.available_placements) : [];
    const colors = new Set<string>();
    const sizes = new Set<string>();
    if (productData?.variants) {
      for (const v of productData.variants) {
        if (v.color) colors.add(v.color);
        if (v.size) sizes.add(v.size);
      }
    }
    res.json({
      ...productData.product,
      variants: productData.variants,
      placements,
      colors: Array.from(colors),
      sizes: Array.from(sizes),
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/catalog/printful-mapping', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { printifyBlueprintId, printfulProductId, notes } = req.body;
    if (!printifyBlueprintId || !printfulProductId) {
      res.status(400).json({ error: "printifyBlueprintId and printfulProductId required" }); return;
    }
    const existingSnap = await db.collection('printify_printful_mapping')
      .where('printifyBlueprintId', '==', printifyBlueprintId)
      .where('isActive', '==', true).limit(1).get();
    if (!existingSnap.empty) {
      await existingSnap.docs[0].ref.update({ isActive: false, deactivatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    const mappingRef = await db.collection('printify_printful_mapping').add({
      printifyBlueprintId, printfulProductId, isActive: true,
      notes: notes || null, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true, mappingId: mappingRef.id, message: `Mapped Printify #${printifyBlueprintId} → Printful #${printfulProductId}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog/printful-mappings', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('printify_printful_mapping').where('isActive', '==', true).get();
    const mappings: any[] = [];
    snap.forEach(doc => mappings.push({ id: doc.id, ...doc.data() }));
    const hardcoded = Object.entries(DEFAULT_BLUEPRINT_MAPPINGS).map(([bpId, pfId]) => ({
      printifyBlueprintId: parseInt(bpId), printfulProductId: pfId, source: 'hardcoded'
    }));
    res.json({ firestoreMappings: mappings, hardcodedMappings: hardcoded });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ PRODUCTS PAGE: CATALOG PLACEMENTS ============

app.get('/admin/catalog/placements', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as string;
    const blueprintId = req.query.blueprintId ? parseInt(req.query.blueprintId as string) : null;
    const printProviderId = req.query.printProviderId ? parseInt(req.query.printProviderId as string) : null;
    const productId = req.query.productId ? parseInt(req.query.productId as string) : null;

    if (provider === 'printify') {
      if (!blueprintId) { res.status(400).json({ error: "blueprintId required for Printify" }); return; }
      if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }

      let resolvedProviderId = printProviderId;

      if (!resolvedProviderId) {
        try {
          const provSnapshot = await db.collection('printify_providers').get();
          const matching = provSnapshot.docs
            .map(d => d.data())
            .filter(d => (d.blueprintId ?? d.blueprint_id) === blueprintId);
          if (matching.length > 0) {
            const best = matching.reduce((prev, cur) => {
              const prevColors = Array.isArray(prev.availableColors) ? prev.availableColors.length : 0;
              const curColors = Array.isArray(cur.availableColors) ? cur.availableColors.length : 0;
              return curColors > prevColors ? cur : prev;
            });
            resolvedProviderId = best.providerId ?? best.provider_id ?? null;
          }
        } catch (lookupErr: any) {
          console.warn(`[Placements] Provider DB lookup failed for blueprint ${blueprintId}:`, lookupErr.message);
        }
      }

      if (!resolvedProviderId) {
        try {
          const liveProviders = await printifyClient.getPrintProviders(blueprintId);
          if (liveProviders && liveProviders.length > 0) {
            const usaFirst = liveProviders.find((p: any) => p.location?.country === 'US' || p.location?.country === 'USA');
            resolvedProviderId = (usaFirst || liveProviders[0]).id;
          }
        } catch (provErr: any) {
          console.warn(`[Placements] Live provider fetch failed for blueprint ${blueprintId}:`, provErr.message);
        }
      }

      if (!resolvedProviderId) {
        res.status(400).json({ error: "No print provider found for this blueprint. Try syncing the catalog first." });
        return;
      }

      try {
        const variantData = await printifyClient.getVariants(blueprintId, resolvedProviderId);
        const placementSet = new Set<string>();
        if (variantData?.variants) {
          for (const v of variantData.variants) {
            if (v.placeholders) {
              for (const ph of v.placeholders) { placementSet.add(ph.position || ph.placeholder); }
            }
          }
        }
        if (placementSet.size === 0) placementSet.add('front');
        const normalized = normalizePlacements('printify', Array.from(placementSet));
        const mapped = normalized.map(p => ({
          id: p, type: p, title: p.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), additionalPrice: 0,
        }));
        res.json({ placements: mapped, source: 'printify-api' });
      } catch (err: any) {
        res.json({ placements: [{ id: 'front', type: 'front', title: 'Front', additionalPrice: 0 }], source: 'default-fallback' });
      }
      return;
    }

    if (provider === 'printful') {
      if (!productId) { res.status(400).json({ error: "productId required for Printful" }); return; }
      const printfileInfo = await printfulClient.getPrintfiles(productId);
      const rawPlacements = printfileInfo?.available_placements ? Object.keys(printfileInfo.available_placements) : [];
      const printPlacements = rawPlacements.filter(p => !isEmbroideryPlacement(p));
      const grouped = groupPlacementsByLocation('printful', printPlacements);
      const mapped = grouped.map(g => ({
        id: g.internal, type: g.internal,
        title: g.internal.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        additionalPrice: 0,
        methods: g.methods.map(m => ({ method: m.method, providerName: m.providerName })),
      }));
      res.json({ placements: mapped, source: 'printful-api' });
      return;
    }

    res.status(400).json({ error: "provider must be 'printify' or 'printful'" });
  } catch (error: any) {
    console.error("Placement fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

}
