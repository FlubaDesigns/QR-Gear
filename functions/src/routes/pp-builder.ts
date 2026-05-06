import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF, normalizePrintfulCategory } from '../core';
import { PRODUCT_PACKETS_COLLECTION, QR_DYNAMICS_INSTANCES_COLLECTION } from '../constants';
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
// ============ PRODUCTS PAGE: QUEUE/PROCESS ============

app.post('/admin/queue/retry-failed', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const failedSnapshot = await db.collection("mockup_jobs").where("status", "==", "failed").get();
    if (failedSnapshot.empty) {
      res.json({ success: true, reset: 0, message: "No failed jobs to retry" });
      return;
    }
    let resetCount = 0;
    const batch = db.batch();
    for (const doc of failedSnapshot.docs) {
      batch.update(doc.ref, {
        status: "pending",
        error: null,
        retryCount: admin.firestore.FieldValue.increment(1),
        lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      resetCount++;
    }
    await batch.commit();
    console.log(`[Queue CF] Reset ${resetCount} failed jobs to pending`);
    res.json({ success: true, reset: resetCount, message: `Reset ${resetCount} failed jobs to pending` });
  } catch (error: any) {
    console.error("[Queue CF] Error retrying failed:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/queue/process', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 5 } = req.body;
    const processLimit = Math.min(limit, 20);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const processingSnapshot = await db.collection("mockup_jobs").where("status", "==", "processing").limit(50).get();
    let recoveredCount = 0;
    for (const doc of processingSnapshot.docs) {
      const data = doc.data();
      const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
      if (startedAt < fiveMinutesAgo) {
        await db.collection("mockup_jobs").doc(doc.id).update({
          status: "pending", retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        recoveredCount++;
      }
    }
    const pendingSnapshot = await db.collection("mockup_jobs").where("status", "==", "pending").limit(processLimit).get();
    if (pendingSnapshot.empty) {
      res.json({ success: true, processed: 0, recovered: recoveredCount, message: "No pending jobs in queue" });
      return;
    }
    console.log(`[Queue CF] Processing ${pendingSnapshot.size} mockup jobs`);
    const results: Array<{ jobId: string; status: string; error?: string }> = [];
    for (const jobDoc of pendingSnapshot.docs) {
      const job = jobDoc.data();
      const jobId = jobDoc.id;
      try {
        const claimed = await db.runTransaction(async (transaction) => {
          const jobRef = db.collection("mockup_jobs").doc(jobId);
          const freshDoc = await transaction.get(jobRef);
          if (!freshDoc.exists || freshDoc.data()?.status !== "pending") return false;
          transaction.update(jobRef, { status: "processing", startedAt: admin.firestore.FieldValue.serverTimestamp(), processorId: `cf-${Date.now()}` });
          return true;
        });
        if (!claimed) { console.log(`[Queue CF] Job ${jobId} already claimed`); continue; }
        await new Promise(resolve => setTimeout(resolve, 2000));
        const templateDoc = await db.collection("productTemplates").doc(job.templateId).get();
        if (!templateDoc.exists) throw new Error(`Template ${job.templateId} not found`);
        const template = templateDoc.data()!;
        const mockupResult = await generateMockupFromPrintful({
          blueprintId: template.blueprintId || 5,
          printProviderId: template.printProviderId || 39,
          colorName: job.colorName,
          artworkUrl: template.artworkUrl,
          artworkVariant: template.artworkVariant || "black",
          fulfillmentProvider: template.fulfillmentProvider || job.fulfillmentProvider || "printify",
          hasCompositeGraphic: true,
        });
        if ((mockupResult as any).error) throw new Error((mockupResult as any).error);
        const colorKey = job.colorName.replace(/\s+/g, "_").toLowerCase();
        const placementKey = job.placement || "front";
        const sizeKey = job.qrSize || "large";
        const mockupPath = `mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`;
        await db.collection("productTemplates").doc(job.templateId).update({
          [mockupPath]: (mockupResult as any).mockupUrl || null,
          [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: (mockupResult as any).lifestyleUrl || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection("mockup_jobs").doc(jobId).update({
          status: "completed", mockupUrl: (mockupResult as any).mockupUrl || null,
          lifestyleUrl: (mockupResult as any).lifestyleUrl || null,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ jobId, status: "completed" });
        console.log(`[Queue CF] Job ${jobId} completed`);
      } catch (error: any) {
        console.error(`[Queue CF] Job ${jobId} failed:`, error.message);
        await db.collection("mockup_jobs").doc(jobId).update({
          status: "failed", error: error.message, failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ jobId, status: "failed", error: error.message });
      }
    }
    const completed = results.filter(r => r.status === "completed").length;
    const failed = results.filter(r => r.status === "failed").length;
    res.json({ success: true, processed: results.length, completed, failed, recovered: recoveredCount, results, message: `Processed ${results.length} jobs: ${completed} completed, ${failed} failed` });
  } catch (error: any) {
    console.error("[Queue CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ============ PRODUCTS PAGE: MOCKUP PRIORITY ============

app.post('/admin/mockup/priority', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
    if (!blueprintId || !colorName || !artworkUrl) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" });
      return;
    }
    console.log(`[Priority Mockup CF] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId),
      printProviderId: printProviderId ? parseInt(printProviderId) : 0,
      colorName,
      colorHex,
      artworkUrl,
      artworkVariant: "black",
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      hasCompositeGraphic: true,
    });
    console.log(`[Priority Mockup CF] Generated: ${(result as any).mockupUrl}`);
    res.json({
      success: true, mockupUrl: (result as any).mockupUrl,
      lifestyleMockupUrl: (result as any).lifestyleUrl || null,
      fromCache: false, generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Priority Mockup CF] Error:", error);
    res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
  }
});

// ============ PRODUCTS PAGE: CONTENT UPLOAD ============

app.post('/admin/content/upload', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode, userId, packetId, base64Data, mimeType, fileName } = req.body;
    if (!mode || !userId || !packetId || !base64Data) {
      res.status(400).json({ error: "mode, userId, packetId, and base64Data are required" });
      return;
    }
    const validModes = ['canvas', 'play', 'dynamics', 'basics'];
    if (!validModes.includes(mode)) {
      res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
      return;
    }
    const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    const actualMimeType = base64Match?.[1] || mimeType || 'image/png';
    const actualBase64 = base64Match?.[2] || base64Data;
    if (!actualBase64 || actualBase64.length === 0) {
      res.status(400).json({ error: 'No file data received' });
      return;
    }
    const buffer = Buffer.from(actualBase64, 'base64');
    if (buffer.length === 0) { res.status(400).json({ error: 'File data is empty after decoding' }); return; }
    const ext = actualMimeType.includes('png') ? 'png' : actualMimeType.includes('mp4') ? 'mp4' : actualMimeType.includes('webm') ? 'webm' : 'jpg';
    const storagePath = `content/${mode}/${userId}/${packetId}/${Date.now()}.${ext}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, { metadata: { contentType: actualMimeType } });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (mode === 'canvas' || mode === 'basics') { updateData.compositeUrl = publicUrl; }
    else if (mode === 'play') { updateData.playMediaUrl = publicUrl; updateData.playMediaType = actualMimeType; }
    else if (mode === 'dynamics') { updateData.dynamicsMediaUrl = publicUrl; updateData.dynamicsMediaType = actualMimeType; }
    await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).update(updateData);
    console.log(`[Content Upload CF] Uploaded ${mode} content for packet ${packetId}`);
    res.json({ success: true, publicUrl, storagePath, mimeType: actualMimeType, message: `${mode} content uploaded successfully` });
  } catch (error: any) {
    console.error("[Content Upload CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: COMPOSE (QR DYNAMICS) ============

app.get('/admin/published-compose-items', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('packets').where('status', '==', 'published').get();
    const items = snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => ['qr-canvas', 'qr-play'].includes(p.packetType || p.type));
    res.json({ items });
  } catch (error: any) {
    console.error("[ComposeItems CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/compose/publish', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { composeItems, composeMode, composeHostingTerm, productId, blueprintId, color, colorHex } = req.body;
    if (!composeItems || !Array.isArray(composeItems) || composeItems.length === 0) {
      res.status(400).json({ error: 'At least one compose item is required' });
      return;
    }
    const nowEpoch = Math.floor(Date.now() / 1000);
    const instanceData = {
      createdAt: nowEpoch, startTimestamp: nowEpoch,
      mode: composeMode || 'auto-rotate', hostingTerm: composeHostingTerm || '1-year',
      productId: productId || null, blueprintId: blueprintId || null,
      color: color || null, colorHex: colorHex || null,
      slots: composeItems.map((item: any, index: number) => ({
        slotId: item.slotId || `slot-${Date.now()}-${index}`,
        packetId: item.packetId || item.id,
        durationSeconds: item.durationSeconds || 86400,
        order: item.order ?? index + 1,
      })),
    };
    const docRef = await db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).add(instanceData);
    console.log(`[ComposePublish CF] Created instance ${docRef.id} with ${composeItems.length} slots`);
    res.json({ success: true, instanceId: docRef.id, composeInstanceId: docRef.id });
  } catch (error: any) {
    console.error("[ComposePublish CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: SHELF GROUPS & BUILD SHELF ============

app.get('/admin/shelf-groups', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection("admin_shelf_groups").orderBy("sortOrder", "asc").get();
    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(groups);
  } catch (error: any) {
    console.error("[BuildShelf CF] List groups error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/shelf-groups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, sortOrder = 0 } = req.body;
    if (!name || typeof name !== 'string' || name.length === 0) { res.status(400).json({ error: "name is required" }); return; }
    const existing = await db.collection("admin_shelf_groups").where("name", "==", name).get();
    if (!existing.empty) { res.status(409).json({ error: "A group with that name already exists" }); return; }
    const docRef = await db.collection("admin_shelf_groups").add({
      name, sortOrder, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json({ id: docRef.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Create group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/shelf-groups/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, sortOrder } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) {
      const existing = await db.collection("admin_shelf_groups").where("name", "==", name).get();
      if (!existing.empty && existing.docs[0].id !== req.params.id) { res.status(409).json({ error: "A group with that name already exists" }); return; }
      updates.name = name;
    }
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("admin_shelf_groups").doc(req.params.id).update(updates);
    const doc = await db.collection("admin_shelf_groups").doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Update group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/shelf-groups/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection("admin_shelf_groups").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error("[BuildShelf CF] Delete group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/build-shelf', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider, groupId, catalogId, mode } = req.query;
    let items: any[];
    if (catalogId) {
      const snapshot = await db.collection("admin_build_shelf").where("catalogId", "==", catalogId).orderBy("createdAt", "desc").get();
      items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (groupId) {
      const snapshot = await db.collection("admin_build_shelf").where("groupIds", "array-contains", groupId).orderBy("createdAt", "desc").get();
      items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (mode === "global") {
      const snapshot = await db.collection("admin_build_shelf").orderBy("createdAt", "desc").get();
      items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      res.status(400).json({ error: "catalogId is required. Pass ?mode=global to list all shelf items." });
      return;
    }
    if (provider) { items = items.filter((item: any) => item.providerId === provider); }

    // Augment each shelf item's catalog with images[] and qrgCategory from master_catalog.
    const shelfKeys = [...new Set(items.map((i: any) => i.shelfKey).filter(Boolean))] as string[];
    if (shelfKeys.length > 0) {
      const CHUNK = 30;
      const masterMap = new Map<string, any>();
      for (let i = 0; i < shelfKeys.length; i += CHUNK) {
        const chunk = shelfKeys.slice(i, i + CHUNK);
        const docs = await Promise.all(chunk.map((key: string) => db.collection("master_catalog").doc(key).get()));
        for (const doc of docs) {
          if (doc.exists) masterMap.set(doc.id, doc.data());
        }
      }
      items = items.map((item: any) => {
        const master = masterMap.get(item.shelfKey);
        const masterImages: string[] = master?.images || [];
        const qrgCategory: string | null = master?.qrgCategory || null;
        if (!masterImages.length && !qrgCategory) return item;
        const catalogPatch: Record<string, any> = {};
        if (masterImages.length) catalogPatch.images = masterImages;
        if (qrgCategory) catalogPatch.qrgCategory = qrgCategory;
        return { ...item, catalog: { ...item.catalog, ...catalogPatch } };
      });
    }

    res.json(items);
  } catch (error: any) {
    console.error("[BuildShelf CF] List items error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/build-shelf', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, catalogId, catalog, groupIds = [] } = req.body;
    if (!providerId || !catalogId || !catalog) { res.status(400).json({ error: "providerId, catalogId, and catalog are required" }); return; }
    const key = `${providerId}:${catalogId}`;
    const existing = await db.collection("admin_build_shelf").where("shelfKey", "==", key).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({ catalog, groupIds, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      const updated = await existing.docs[0].ref.get();
      res.json({ id: updated.id, ...updated.data() });
      return;
    }
    const docRef = await db.collection("admin_build_shelf").add({
      shelfKey: key, providerId, catalogId, catalog, groupIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json({ id: docRef.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Add item error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/build-shelf/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updates: Record<string, any> = {};
    if (req.body.groupIds !== undefined) updates.groupIds = req.body.groupIds;
    if (req.body.catalog !== undefined) updates.catalog = req.body.catalog;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("admin_build_shelf").doc(req.params.id).update(updates);
    const doc = await db.collection("admin_build_shelf").doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Update item error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/build-shelf/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection("admin_build_shelf").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error("[BuildShelf CF] Delete item error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRICING SETTINGS SYNC ============

app.post('/admin/pricing-settings/sync', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const pricingDoc = await db.collection("testSettings").doc("pricing").get();
    const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
    const markupPercent = pricingSettings?.markupPercent ?? 25;
    const markupFixed = pricingSettings?.markupFixed ?? 0;
    const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
    const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
    console.log(`[Pricing Sync CF] Settings: markup=${markupPercent}%, fixed=${markupFixed}, memberShare=${memberProfitShare}`);
    res.json({
      success: true,
      message: "Pricing sync completed",
      settings: { markupPercent, markupFixed, memberProfitShare, additionalPlacementCost },
    });
  } catch (error: any) {
    console.error("[Pricing Sync CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});



  }
